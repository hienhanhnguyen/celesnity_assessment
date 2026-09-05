import { Inject, Injectable } from '@nestjs/common';
import type { BatchRecord, CanonicalRecord } from '../production/production.types';
import { stationIndex } from '../common/domain/station';
import {
  OBSERVATIONS_STORE,
  type NormalizedRecordView,
  type ObservationsFilter,
  type ObservationsStore,
} from './observations.types';

@Injectable()
export class ObservationsService {
  constructor(@Inject(OBSERVATIONS_STORE) private readonly store: ObservationsStore) {}

  async list(filter: ObservationsFilter = {}): Promise<NormalizedRecordView[]> {
    const [canonical, batches] = await Promise.all([this.store.loadCanonical(), this.store.loadBatches()]);
    const batchById = new Map(batches.map((b) => [b.batchId, b]));

    return canonical
      .filter((record) => matches(record, batchById.get(record.batchId), filter))
      .map((record) => toView(record, batchById.get(record.batchId)))
      .sort((a, b) => a.batchId.localeCompare(b.batchId) || stationIndex(a.station) - stationIndex(b.station));
  }
}

function matches(
  record: CanonicalRecord,
  batch: BatchRecord | undefined,
  filter: ObservationsFilter,
): boolean {
  if (filter.batchId && record.batchId !== filter.batchId) return false;
  if (filter.station && record.station !== filter.station) return false;
  if (filter.sourceType && record.sourceType !== filter.sourceType) return false;
  if (filter.lineId && batch?.lineId !== filter.lineId) return false;
  return true;
}

function toView(record: CanonicalRecord, batch: BatchRecord | undefined): NormalizedRecordView {
  return {
    batchId: record.batchId,
    workOrderId: batch?.workOrderId ?? null,
    lineId: batch?.lineId ?? null,
    station: record.station,
    sourceType: record.sourceType,
    quantity: record.quantity,
    eventTime: record.eventTime,
    late: record.late,
    conflictFlags: record.conflictFlags,
    provenance: {
      observationId: record.winningObservationId,
      sourceId: record.sourceId,
      runId: record.runId,
      sourceRecordId: record.sourceRecordId,
      supersededObservationIds: record.supersededObservationIds,
    },
  };
}
