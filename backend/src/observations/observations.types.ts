import type { SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';
import type { BatchRecord, CanonicalRecord } from '../production/production.types';

export const OBSERVATIONS_STORE = Symbol('OBSERVATIONS_STORE');

export interface ObservationsFilter {
  batchId?: string;
  station?: Station;
  lineId?: string;
  sourceType?: SourceType;
}

export interface NormalizedProvenance {
  observationId: string;
  sourceId: string;
  runId: string;
  sourceRecordId: string;
  supersededObservationIds: string[];
}

export interface NormalizedRecordView {
  batchId: string;
  workOrderId: string | null;
  lineId: string | null;
  station: Station;
  sourceType: SourceType;
  quantity: number | null;
  eventTime: Date;
  late: boolean;
  conflictFlags: string[];
  provenance: NormalizedProvenance;
}

export interface ObservationsStore {
  loadCanonical(): Promise<CanonicalRecord[]>;
  loadBatches(): Promise<BatchRecord[]>;
}
