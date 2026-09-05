import type { ManagementEventType, BatchState } from '../common/domain/enums';
import type { Station } from '../common/domain/station';
import type { SourceType } from '../common/domain/enums';

export const PRODUCTION_STORE = Symbol('PRODUCTION_STORE');

export interface BatchRecord {
  batchId: string;
  workOrderId: string;
  lineId: string;
}

export interface CanonicalRecord {
  batchId: string;
  station: Station;
  sourceType: SourceType;
  quantity: number | null;
  eventTime: Date;
  late: boolean;
  conflictFlags: string[];
  winningObservationId: string;
  supersededObservationIds: string[];
  sourceId: string;
  runId: string;
  sourceRecordId: string;
}

export interface ManagementRecord {
  id: string;
  batchId: string;
  type: ManagementEventType;
  actor: string;
  organizationId: string;
  note: string | null;
  createdAt: Date;
}

export interface ProductionStore {
  loadBatches(): Promise<BatchRecord[]>;
  loadCanonicalEvents(): Promise<CanonicalRecord[]>;
  loadManagementEvents(): Promise<ManagementRecord[]>;
}

export interface FreshnessView {
  lastEventTime: Date | null;
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
  eventTime: Date;
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
  createdAt: Date;
}

export interface BatchDetail extends BatchSummary {
  timeline: TimelineEntry[];
  managementEvents: ManagementEntry[];
}

export interface StationView {
  station: Station;
  wip: number;
  completedQuantity: number;
  lastEventTime: Date | null;
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
