export const SOURCE_TYPES = ['API', 'CRAWLER', 'DATABASE'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = ['REGISTERED', 'VERIFIED', 'FAILED'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const RUN_STATUSES = ['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STATIONS = ['RECEIVING', 'SORTING', 'WASHING', 'DRYING', 'FOLDING', 'DISPATCH'] as const;
export type Station = (typeof STATIONS)[number];

export interface SourceView {
  id: string;
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  status: SourceStatus;
  hasSecret: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface RunView {
  id: string;
  sourceId: string;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  fetched: number;
  normalized: number;
  duplicates: number;
  malformed: number;
  errors: number;
  trigger: string | null;
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
  eventTime: string;
  late: boolean;
  conflictFlags: string[];
  provenance: NormalizedProvenance;
}

export interface RegisterSourceBody {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection?: Record<string, unknown>;
  secret?: string;
}

export interface ObservationsFilter {
  batchId?: string;
  station?: Station;
  lineId?: string;
  sourceType?: SourceType;
}

export const BATCH_STATES = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;
export type BatchState = (typeof BATCH_STATES)[number];

export const MANAGEMENT_EVENT_TYPES = ['ACKNOWLEDGE', 'BLOCK', 'RESUME', 'NOTE'] as const;
export type ManagementEventType = (typeof MANAGEMENT_EVENT_TYPES)[number];

export interface FreshnessView {
  lastEventTime: string | null;
  minutesSinceLastEvent: number | null;
  stale: boolean;
}

export interface BatchIndicators {
  stale: boolean;
  blocked: boolean;
  missingData: boolean;
  quality: boolean;
}

export interface BatchSummary {
  batchId: string;
  workOrderId: string;
  lineId: string;
  state: BatchState;
  currentStation: Station | null;
  currentQuantity: number | null;
  freshness: FreshnessView;
  indicators: BatchIndicators;
}

export interface TimelineProvenance {
  observationId: string;
  sourceId: string;
  runId: string;
  sourceRecordId: string;
  supersededObservationIds: string[];
}

export interface TimelineEntry {
  station: Station;
  sourceType: SourceType;
  quantity: number | null;
  eventTime: string;
  late: boolean;
  conflictFlags: string[];
  provenance: TimelineProvenance;
}

export interface ManagementEntry {
  id: string;
  type: ManagementEventType;
  actor: string;
  organizationId: string;
  note: string | null;
  createdAt: string;
}

export interface BatchDetail extends BatchSummary {
  timeline: TimelineEntry[];
  managementEvents: ManagementEntry[];
}

export interface StationView {
  station: Station;
  wip: number;
  completedQuantity: number;
  lastEventTime: string | null;
  stale: boolean;
}

export interface LineView {
  lineId: string;
  batchCount: number;
  stations: StationView[];
}

export interface ConfigView {
  staleThresholdMinutes: number;
  stations: Station[];
  seed: { organizationId: string; actor: string };
}

export interface BatchFilter {
  lineId?: string;
  state?: BatchState;
}
