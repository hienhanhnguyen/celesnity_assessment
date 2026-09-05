import type { CollectionErrorKind, SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';

export interface RawObservation {
  sourceRecordId: string;
  station: Station;
  batchId: string;
  workOrderId?: string | null;
  lineId?: string | null;
  quantity?: number | null;
  eventType?: string | null;
  eventTime: Date;
  rawPayload: Record<string, unknown>;
}

export interface RawWorkOrder {
  workOrderId: string;
  lineId: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
}

export interface RawBatchMapping {
  batchId: string;
  workOrderId: string | null;
  lineId: string | null;
  metadata: Record<string, unknown>;
}

export interface ReferenceData {
  workOrders: RawWorkOrder[];
  batches: RawBatchMapping[];
}

export interface CollectorError {
  kind: CollectionErrorKind;
  message: string;
  context?: Record<string, unknown>;
}

export interface CollectStats {
  fetched: number;
  pagesFetched: number;
  malformed: number;
}

export interface CollectResult {
  observations: RawObservation[];
  references?: ReferenceData;
  errors: CollectorError[];
  stats: CollectStats;
}

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: Record<string, unknown>;
}

export interface DiscoveredEntity {
  name: string;
  kind: 'endpoint' | 'table' | 'topic';
  produces: 'reference' | 'observations';
  fields?: string[];
}

export interface DiscoverResult {
  entities: DiscoveredEntity[];
}

export interface SourceContext {
  config: Record<string, unknown>;
  selection?: Record<string, unknown> | null;
  secret?: string | null;
}

export interface SourceCollector {
  readonly type: SourceType;
  test(ctx: SourceContext): Promise<TestResult>;
  discover(ctx: SourceContext): Promise<DiscoverResult>;
  collect(ctx: SourceContext): Promise<CollectResult>;
}
