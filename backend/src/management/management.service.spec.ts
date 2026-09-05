import { NotFoundException } from '@nestjs/common';
import { BatchState, ManagementEventType, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { Clock } from '../common/time/clock';
import type { AppConfigService } from '../config/app-config.service';
import { ProductionService } from '../production/production.service';
import type {
  BatchRecord,
  CanonicalRecord,
  ManagementRecord,
  ProductionStore,
} from '../production/production.types';
import { ManagementService } from './management.service';
import type {
  ManagementEventRecord,
  ManagementStore,
  NewManagementEvent,
} from './management.types';

class SharedStore implements ProductionStore, ManagementStore {
  private seq = 0;
  constructor(
    private readonly batches: BatchRecord[],
    private readonly events: CanonicalRecord[],
    readonly management: ManagementRecord[],
    private readonly base: Date,
  ) {}

  async loadBatches(): Promise<BatchRecord[]> {
    return this.batches;
  }
  async loadCanonicalEvents(): Promise<CanonicalRecord[]> {
    return this.events;
  }
  async loadManagementEvents(): Promise<ManagementRecord[]> {
    return this.management;
  }

  async batchExists(batchId: string): Promise<boolean> {
    return this.batches.some((batch) => batch.batchId === batchId);
  }
  async append(event: NewManagementEvent): Promise<ManagementEventRecord> {
    this.seq += 1;
    const record: ManagementRecord = {
      id: `mgmt-${this.seq}`,
      batchId: event.batchId,
      type: event.type,
      actor: event.actor,
      organizationId: event.organizationId,
      note: event.note,
      createdAt: new Date(this.base.getTime() + this.seq * 1000),
    };
    this.management.push(record);
    return record;
  }
}

// fixtures 
const NOW = new Date('2026-09-03T12:00:00.000Z');
const mins = (n: number) => new Date(NOW.getTime() - n * 60_000);
const clock: Clock = { now: () => NOW };
const config = {
  domain: { staleThresholdMinutes: 15, seedOrgId: 'org-celesnity-001', seedActor: 'manager@celesnity.local' },
} as unknown as AppConfigService;

let seq = 0;
function cell(batchId: string, station: Station, minutesAgo: number, quantity: number | null): CanonicalRecord {
  seq += 1;
  return {
    batchId,
    station,
    sourceType: SourceType.DATABASE,
    quantity,
    eventTime: mins(minutesAgo),
    late: false,
    conflictFlags: [],
    winningObservationId: `obs-${seq}`,
    supersededObservationIds: [],
    sourceId: 'src-1',
    runId: 'run-1',
    sourceRecordId: `rec-${seq}`,
  };
}

function setup() {
  const batches: BatchRecord[] = [
    { batchId: 'BATCH-0100', workOrderId: 'WO-1', lineId: 'LINE-A' }, // IN_PROGRESS @ WASHING
    { batchId: 'BATCH-0200', workOrderId: 'WO-2', lineId: 'LINE-A' }, // COMPLETED
  ];
  const events: CanonicalRecord[] = [
    cell('BATCH-0100', Station.RECEIVING, 90, null),
    cell('BATCH-0100', Station.SORTING, 80, 60),
    cell('BATCH-0100', Station.WASHING, 5, 60),
    cell('BATCH-0200', Station.RECEIVING, 200, null),
    cell('BATCH-0200', Station.SORTING, 180, 80),
    cell('BATCH-0200', Station.WASHING, 160, 80),
    cell('BATCH-0200', Station.DRYING, 140, 80),
    cell('BATCH-0200', Station.FOLDING, 120, 80),
    cell('BATCH-0200', Station.DISPATCH, 100, 80),
  ];
  const management: ManagementRecord[] = [];
  const store = new SharedStore(batches, events, management, NOW);
  const production = new ProductionService(store, clock, config);
  const service = new ManagementService(store, config, production);
  return { store, events, management, production, service };
}

describe('ManagementService - block / resume recompute state', () => {
  it('block recomputes the batch to BLOCKED and returns the fresh view', async () => {
    const { service } = setup();
    const detail = await service.block('BATCH-0100', 'washer jam');

    expect(detail.batchId).toBe('BATCH-0100');
    expect(detail.state).toBe(BatchState.BLOCKED);
    expect(detail.indicators.blocked).toBe(true);
    expect(detail.currentStation).toBe(Station.WASHING);
    expect(detail.managementEvents).toHaveLength(1);
    expect(detail.managementEvents[0]).toMatchObject({ type: ManagementEventType.BLOCK, note: 'washer jam' });
  });

  it('resume after block recomputes back to the underlying state', async () => {
    const { service } = setup();
    await service.block('BATCH-0100', null);
    const detail = await service.resume('BATCH-0100', null);

    expect(detail.state).toBe(BatchState.IN_PROGRESS);
    expect(detail.indicators.blocked).toBe(false);
    expect(detail.currentStation).toBe(Station.WASHING);
    expect(detail.managementEvents.map((event) => event.type)).toEqual([
      ManagementEventType.BLOCK,
      ManagementEventType.RESUME,
    ]);
  });

  it('a block on a COMPLETED batch is recorded but state precedence keeps it COMPLETED', async () => {
    const { service } = setup();
    const detail = await service.block('BATCH-0200', null);

    expect(detail.state).toBe(BatchState.COMPLETED);
    expect(detail.indicators.blocked).toBe(true);
    expect(detail.managementEvents).toHaveLength(1);
  });
});

describe('ManagementService - acknowledge / note are audit-only', () => {
  it('acknowledge does not change state', async () => {
    const { service } = setup();
    const detail = await service.acknowledge('BATCH-0100', 'seen');

    expect(detail.state).toBe(BatchState.IN_PROGRESS);
    expect(detail.indicators.blocked).toBe(false);
    expect(detail.managementEvents[0]).toMatchObject({
      type: ManagementEventType.ACKNOWLEDGE,
      note: 'seen',
    });
  });

  it('note records the note text without changing state', async () => {
    const { service } = setup();
    const detail = await service.note('BATCH-0100', 'call maintenance');

    expect(detail.state).toBe(BatchState.IN_PROGRESS);
    expect(detail.managementEvents[0]).toMatchObject({
      type: ManagementEventType.NOTE,
      note: 'call maintenance',
    });
  });
});

describe('ManagementService - provenance is server-owned', () => {
  it('stamps the seeded org + actor and a store-assigned id + timestamp', async () => {
    const { service } = setup();
    const detail = await service.acknowledge('BATCH-0100', null);

    const event = detail.managementEvents[0];
    expect(event.actor).toBe('manager@celesnity.local');
    expect(event.organizationId).toBe('org-celesnity-001');
    expect(event.note).toBeNull();
    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.createdAt).toBeInstanceOf(Date);
  });
});

describe('ManagementService - append-only immutability', () => {
  it('accumulates actions in order and never rewrites earlier entries', async () => {
    const { service, management } = setup();

    await service.block('BATCH-0100', 'jam');
    const firstSnapshot = { ...management[0] };

    await service.resume('BATCH-0100', null);
    await service.note('BATCH-0100', 'resolved');

    expect(management).toHaveLength(3);
    expect(management.map((event) => event.type)).toEqual([
      ManagementEventType.BLOCK,
      ManagementEventType.RESUME,
      ManagementEventType.NOTE,
    ]);
    expect(management[0]).toEqual(firstSnapshot);
    expect(management[0].createdAt.getTime()).toBeLessThan(management[1].createdAt.getTime());
    expect(management[1].createdAt.getTime()).toBeLessThan(management[2].createdAt.getTime());
  });

  it('never touches source / canonical history', async () => {
    const { service, store, events } = setup();
    const before = structuredClone(events);

    await service.block('BATCH-0100', null);
    await service.resume('BATCH-0100', null);
    await service.note('BATCH-0100', 'x');

    expect(await store.loadCanonicalEvents()).toEqual(before);
    const timeline = (await service.acknowledge('BATCH-0100', null)).timeline;
    expect(timeline.map((entry) => entry.station)).toEqual([
      Station.RECEIVING,
      Station.SORTING,
      Station.WASHING,
    ]);
  });
});

describe('ManagementService - unknown batch', () => {
  it('404s and appends nothing', async () => {
    const { service, management } = setup();

    await expect(service.block('BATCH-NOPE', null)).rejects.toBeInstanceOf(NotFoundException);
    expect(management).toHaveLength(0);
  });
});
