import type { ManagementEventType, SourceType } from '../common/domain/enums';

export const SEED_STORE = Symbol('SEED_STORE');

export interface SeedWorkOrderInput {
  workOrderId: string;
  lineId: string;
  status: string | null;
}

export interface SeedBatchInput {
  batchId: string;
  workOrderId: string;
  lineId: string;
}

export interface SeedSourceInput {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
}

export interface SeedManagementInput {
  batchId: string;
  type: ManagementEventType;
  organizationId: string;
  actor: string;
  note: string | null;
}

export interface SeedStore {
  upsertWorkOrders(rows: SeedWorkOrderInput[]): Promise<void>;
  upsertBatches(rows: SeedBatchInput[]): Promise<void>;
  sourceExists(name: string): Promise<boolean>;
  insertSource(row: SeedSourceInput): Promise<void>;
  managementEventExists(batchId: string, type: ManagementEventType): Promise<boolean>;
  insertManagementEvent(row: SeedManagementInput): Promise<void>;
}
