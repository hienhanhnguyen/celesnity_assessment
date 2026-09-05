import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { STATION_ORDER, Station, stationIndex } from '../common/domain/station';
import { BatchState } from '../common/domain/enums';
import { CLOCK, type Clock } from '../common/time/clock';
import { computeBatchSummary } from './production.domain';
import {
  PRODUCTION_STORE,
  type BatchDetail,
  type BatchFilter,
  type BatchRecord,
  type BatchSummary,
  type CanonicalRecord,
  type ConfigView,
  type LineView,
  type ManagementEntry,
  type ManagementRecord,
  type ProductionStore,
  type StationView,
  type TimelineEntry,
} from './production.types';

interface Snapshot {
  batches: BatchRecord[];
  eventsByBatch: Map<string, CanonicalRecord[]>;
  managementByBatch: Map<string, ManagementRecord[]>;
  now: Date;
  threshold: number;
}

@Injectable()
export class ProductionService {
  constructor(
    @Inject(PRODUCTION_STORE) private readonly store: ProductionStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfigService,
  ) {}

  getConfig(): ConfigView {
    const domain = this.config.domain;
    return {
      staleThresholdMinutes: domain.staleThresholdMinutes,
      stations: [...STATION_ORDER],
      seed: { organizationId: domain.seedOrgId, actor: domain.seedActor },
    };
  }

  async getLines(): Promise<LineView[]> {
    const snapshot = await this.loadSnapshot();
    const summaries = this.summarize(snapshot);
    const lineIds = [...new Set(snapshot.batches.map((batch) => batch.lineId))].sort();
    return lineIds.map((lineId) => this.buildLine(lineId, snapshot, summaries));
  }

  async getLine(lineId: string): Promise<LineView> {
    const snapshot = await this.loadSnapshot();
    if (!snapshot.batches.some((batch) => batch.lineId === lineId)) {
      throw new NotFoundException(`Unknown line: ${lineId}`);
    }
    return this.buildLine(lineId, snapshot, this.summarize(snapshot));
  }

  async getBatches(filter: BatchFilter = {}): Promise<BatchSummary[]> {
    const snapshot = await this.loadSnapshot();
    let summaries = [...this.summarize(snapshot).values()];
    if (filter.lineId !== undefined) {
      summaries = summaries.filter((summary) => summary.lineId === filter.lineId);
    }
    if (filter.state !== undefined) {
      summaries = summaries.filter((summary) => summary.state === filter.state);
    }
    return summaries.sort((a, b) => a.batchId.localeCompare(b.batchId));
  }

  async getBatch(batchId: string): Promise<BatchDetail> {
    const snapshot = await this.loadSnapshot();
    const batch = snapshot.batches.find((candidate) => candidate.batchId === batchId);
    if (!batch) {
      throw new NotFoundException(`Unknown batch: ${batchId}`);
    }
    const events = snapshot.eventsByBatch.get(batchId) ?? [];
    const management = snapshot.managementByBatch.get(batchId) ?? [];
    const summary = computeBatchSummary(batch, events, management, snapshot.now, snapshot.threshold);
    return {
      ...summary,
      timeline: this.buildTimeline(events),
      managementEvents: this.buildManagement(management),
    };
  }

  private async loadSnapshot(): Promise<Snapshot> {
    const [batches, events, management] = await Promise.all([
      this.store.loadBatches(),
      this.store.loadCanonicalEvents(),
      this.store.loadManagementEvents(),
    ]);
    return {
      batches,
      eventsByBatch: groupBy(events, (event) => event.batchId),
      managementByBatch: groupBy(management, (action) => action.batchId),
      now: this.clock.now(),
      threshold: this.config.domain.staleThresholdMinutes,
    };
  }

  private summarize(snapshot: Snapshot): Map<string, BatchSummary> {
    const summaries = new Map<string, BatchSummary>();
    for (const batch of snapshot.batches) {
      summaries.set(
        batch.batchId,
        computeBatchSummary(
          batch,
          snapshot.eventsByBatch.get(batch.batchId) ?? [],
          snapshot.managementByBatch.get(batch.batchId) ?? [],
          snapshot.now,
          snapshot.threshold,
        ),
      );
    }
    return summaries;
  }

  private buildLine(lineId: string, snapshot: Snapshot, summaries: Map<string, BatchSummary>): LineView {
    const batches = snapshot.batches.filter((batch) => batch.lineId === lineId);
    const stations = STATION_ORDER.map((station) =>
      this.buildStation(station, batches, snapshot, summaries),
    );
    return { lineId, batchCount: batches.length, stations };
  }

  private buildStation(
    station: Station,
    batches: BatchRecord[],
    snapshot: Snapshot,
    summaries: Map<string, BatchSummary>,
  ): StationView {
    let completedQuantity = 0;
    let lastEventTime: Date | null = null;
    let wip = 0;
    for (const batch of batches) {
      const events = snapshot.eventsByBatch.get(batch.batchId) ?? [];
      const cell = events.find((event) => event.station === station);
      if (cell) {
        completedQuantity += cell.quantity ?? 0;
        if (lastEventTime === null || cell.eventTime.getTime() > lastEventTime.getTime()) {
          lastEventTime = cell.eventTime;
        }
      }
      const summary = summaries.get(batch.batchId);
      if (summary && summary.state !== BatchState.COMPLETED && summary.currentStation === station) {
        wip += 1;
      }
    }
    const stale =
      lastEventTime !== null &&
      (snapshot.now.getTime() - lastEventTime.getTime()) / 60_000 > snapshot.threshold;
    return { station, wip, completedQuantity, lastEventTime, stale };
  }

  private buildTimeline(events: CanonicalRecord[]): TimelineEntry[] {
    return [...events]
      .sort((a, b) => stationIndex(a.station) - stationIndex(b.station))
      .map((event) => ({
        station: event.station,
        sourceType: event.sourceType,
        quantity: event.quantity,
        eventTime: event.eventTime,
        late: event.late,
        conflictFlags: event.conflictFlags,
        provenance: {
          observationId: event.winningObservationId,
          sourceId: event.sourceId,
          runId: event.runId,
          sourceRecordId: event.sourceRecordId,
          supersededObservationIds: event.supersededObservationIds,
        },
      }));
  }

  private buildManagement(management: ManagementRecord[]): ManagementEntry[] {
    return [...management]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((action) => ({
        id: action.id,
        type: action.type,
        actor: action.actor,
        organizationId: action.organizationId,
        note: action.note,
        createdAt: action.createdAt,
      }));
  }
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
