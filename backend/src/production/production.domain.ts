import { BatchState, ManagementEventType } from '../common/domain/enums';
import { Station, stationIndex } from '../common/domain/station';
import type {
  BatchIndicators,
  BatchRecord,
  BatchSummary,
  CanonicalRecord,
  FreshnessView,
  ManagementRecord,
} from './production.types';

const LAST_OPERATIONAL_INDEX = stationIndex(Station.FOLDING);

export function currentStation(events: CanonicalRecord[]): Station | null {
  let best: Station | null = null;
  let bestIndex = 0;
  for (const event of events) {
    const index = stationIndex(event.station);
    if (index > bestIndex) {
      bestIndex = index;
      best = event.station;
    }
  }
  return best;
}

export function isBlocked(management: ManagementRecord[]): boolean {
  let latest: ManagementRecord | null = null;
  for (const action of management) {
    if (action.type !== ManagementEventType.BLOCK && action.type !== ManagementEventType.RESUME) {
      continue;
    }
    if (latest === null || isAfter(action, latest)) {
      latest = action;
    }
  }
  return latest?.type === ManagementEventType.BLOCK;
}

function isAfter(a: ManagementRecord, b: ManagementRecord): boolean {
  const delta = a.createdAt.getTime() - b.createdAt.getTime();
  if (delta !== 0) {
    return delta > 0;
  }
  return a.id > b.id;
}

export function computeState(events: CanonicalRecord[], management: ManagementRecord[]): BatchState {
  if (events.some((event) => event.station === Station.DISPATCH)) {
    return BatchState.COMPLETED;
  }
  if (isBlocked(management)) {
    return BatchState.BLOCKED;
  }
  if (events.some((event) => stationIndex(event.station) >= 1 && stationIndex(event.station) <= LAST_OPERATIONAL_INDEX)) {
    return BatchState.IN_PROGRESS;
  }
  return BatchState.PLANNED;
}

export function lastEventTime(events: CanonicalRecord[]): Date | null {
  let latest: Date | null = null;
  for (const event of events) {
    if (latest === null || event.eventTime.getTime() > latest.getTime()) {
      latest = event.eventTime;
    }
  }
  return latest;
}

export function freshness(events: CanonicalRecord[], now: Date, thresholdMinutes: number): FreshnessView {
  const last = lastEventTime(events);
  if (last === null) {
    return { lastEventTime: null, minutesSinceLastEvent: null, stale: false };
  }
  const minutes = (now.getTime() - last.getTime()) / 60_000;
  return {
    lastEventTime: last,
    minutesSinceLastEvent: Math.floor(minutes),
    stale: minutes > thresholdMinutes,
  };
}

export function hasMissingData(events: CanonicalRecord[]): boolean {
  const current = currentStation(events);
  if (current === null) {
    return false;
  }
  const currentIndex = stationIndex(current);
  const present = new Set(events.map((event) => stationIndex(event.station)));
  for (let index = 1; index < currentIndex; index += 1) {
    if (!present.has(index)) {
      return true;
    }
  }
  return false;
}

export function hasQualityConflict(events: CanonicalRecord[]): boolean {
  return events.some((event) => event.conflictFlags.length > 0);
}

export function indicators(
  events: CanonicalRecord[],
  management: ManagementRecord[],
  now: Date,
  thresholdMinutes: number,
): BatchIndicators {
  return {
    stale: freshness(events, now, thresholdMinutes).stale,
    blocked: isBlocked(management),
    missingData: hasMissingData(events),
    quality: hasQualityConflict(events),
  };
}

function currentQuantity(events: CanonicalRecord[], current: Station | null): number | null {
  if (current === null) {
    return null;
  }
  const cell = events.find((event) => event.station === current);
  return cell ? cell.quantity : null;
}

export function computeBatchSummary(
  batch: BatchRecord,
  events: CanonicalRecord[],
  management: ManagementRecord[],
  now: Date,
  thresholdMinutes: number,
): BatchSummary {
  const current = currentStation(events);
  return {
    batchId: batch.batchId,
    workOrderId: batch.workOrderId,
    lineId: batch.lineId,
    state: computeState(events, management),
    currentStation: current,
    currentQuantity: currentQuantity(events, current),
    freshness: freshness(events, now, thresholdMinutes),
    indicators: indicators(events, management, now, thresholdMinutes),
  };
}
