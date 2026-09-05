import type { CanonicalStatus, SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';

export const NORMALIZATION_STORE = Symbol('NORMALIZATION_STORE');

export interface ObservationRecord {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  runId: string;
  runStartedAt: Date | null;
  sourceRecordId: string;
  station: Station;
  batchId: string;
  quantity: number | null;
  eventTime: Date;
}

export interface CanonicalEventInput {
  batchId: string;
  station: Station;
  winningObservationId: string;
  status: CanonicalStatus;
  sourceType: SourceType;
  quantity: number | null;
  eventTime: Date;
  supersededObservationIds: string[];
  conflictFlags: string[];
  late: boolean;
  computedAt: Date;
}

export interface NormalizationResult {
  observationsConsidered: number;
  canonicalEvents: number;
  superseded: number;
  conflicts: number;
  lateEvents: number;
}

export interface NormalizationStore {
  loadObservations(): Promise<ObservationRecord[]>;
  replaceCanonical(events: CanonicalEventInput[]): Promise<void>;
}
