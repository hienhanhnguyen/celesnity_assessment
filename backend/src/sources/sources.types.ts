import type { EncryptedSecret } from '../common/crypto/crypto';
import type { SourceStatus, SourceType } from '../common/domain/enums';
import type { RunView } from '../collection/collection.types';

export const SOURCES_STORE = Symbol('SOURCES_STORE');
export const RUNS_STORE = Symbol('RUNS_STORE');

export interface SourceView {
  id: string;
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  status: SourceStatus;
  hasSecret: boolean;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSource {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  hasSecret: boolean;
  secret: EncryptedSecret | null;
}

export interface SourceContextData {
  type: SourceType;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  secret: EncryptedSecret | null;
}

export interface SourcesStore {
  existsByName(name: string): Promise<boolean>;
  create(input: NewSource): Promise<SourceView>;
  listViews(): Promise<SourceView[]>;
  loadView(id: string): Promise<SourceView | null>;
  loadContext(id: string): Promise<SourceContextData | null>;
  updateSelection(id: string, selection: Record<string, unknown> | null): Promise<SourceView | null>;
  markTested(id: string, testedAt: Date, lastError: string | null): Promise<void>;
}

export interface RunsStore {
  listRuns(sourceId: string | null): Promise<RunView[]>;
  getRun(id: string): Promise<RunView | null>;
}
