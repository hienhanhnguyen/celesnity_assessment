import type { ManagementEventType } from '../common/domain/enums';

export const MANAGEMENT_STORE = Symbol('MANAGEMENT_STORE');

export interface NewManagementEvent {
  batchId: string;
  type: ManagementEventType;
  organizationId: string;
  actor: string;
  note: string | null;
}

export interface ManagementEventRecord extends NewManagementEvent {
  id: string;
  createdAt: Date;
}

export interface ManagementStore {
  batchExists(batchId: string): Promise<boolean>;
  append(event: NewManagementEvent): Promise<ManagementEventRecord>;
}
