import type { EncryptedSecret } from '../common/crypto/crypto';
import type { CollectionErrorKind, RunStatus, SourceStatus, SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';

export const COLLECTION_STORE = Symbol('COLLECTION_STORE');

export interface StoredSource {
  id: string;
  type: SourceType;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  hasSecret: boolean;
  secret: EncryptedSecret | null;
}

export interface ObservationInput {
  runId: string;
  sourceId: string;
  sourceRecordId: string;
  station: Station;
  batchId: string;
  workOrderId: string | null;
  lineId: string | null;
  quantity: number | null;
  eventType: string | null;
  eventTime: Date;
  rawPayload: Record<string, unknown>;
}

export interface ErrorInput {
  runId: string;
  kind: CollectionErrorKind;
  message: string;
  context: Record<string, unknown> | null;
}

export interface WorkOrderInput {
  workOrderId: string;
  lineId: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BatchInput {
  batchId: string;
  workOrderId: string;
  lineId: string;
  metadata: Record<string, unknown> | null;
}
export interface PersistBatch {
  observations: ObservationInput[];
  errors: ErrorInput[];
  workOrders: WorkOrderInput[];
  batches: BatchInput[];
}

export interface RunPatch {
  status?: RunStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  fetched?: number;
  normalized?: number;
  duplicates?: number;
  malformed?: number;
  errors?: number;
}

export interface RunView {
  id: string;
  sourceId: string;
  status: RunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  fetched: number;
  normalized: number;
  duplicates: number;
  malformed: number;
  errors: number;
  trigger: string | null;
}

export interface CollectionStore {
  loadSource(id: string): Promise<StoredSource | null>;
  createRun(sourceId: string, trigger: string | null): Promise<string>;
  patchRun(id: string, patch: RunPatch): Promise<void>;
  loadRun(id: string): Promise<RunView>;
  persist(batch: PersistBatch): Promise<void>;
  updateSourceOutcome(id: string, status: SourceStatus, lastError: string | null): Promise<void>;
}
