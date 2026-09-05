import { BatchState, ManagementEventType, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import {
  computeBatchSummary,
  computeState,
  currentStation,
  freshness,
  hasMissingData,
  hasQualityConflict,
  indicators,
  isBlocked,
  lastEventTime,
} from './production.domain';
import type { BatchRecord, CanonicalRecord, ManagementRecord } from './production.types';

// fixtures

const NOW = new Date('2026-09-03T12:00:00.000Z');
const mins = (n: number) => new Date(NOW.getTime() - n * 60_000);
const THRESHOLD = 15;

let obsSeq = 0;
function ce(station: Station, over: Partial<CanonicalRecord> = {}): CanonicalRecord {
  obsSeq += 1;
  const base: CanonicalRecord = {
    batchId: 'BATCH-0001',
    station,
    sourceType: SourceType.DATABASE,
    quantity: null,
    eventTime: mins(30),
    late: false,
    conflictFlags: [],
    winningObservationId: `obs-${obsSeq}`,
    supersededObservationIds: [],
    sourceId: 'src',
    runId: 'run',
    sourceRecordId: `rec-${obsSeq}`,
  };
  return { ...base, ...over };
}

let mgmtSeq = 0;
function me(type: ManagementEventType, over: Partial<ManagementRecord> = {}): ManagementRecord {
  mgmtSeq += 1;
  const base: ManagementRecord = {
    id: `m-${mgmtSeq}`,
    batchId: 'BATCH-0001',
    type,
    actor: 'manager@celesnity.local',
    organizationId: 'org-celesnity-001',
    note: null,
    createdAt: mins(10),
  };
  return { ...base, ...over };
}

const batch: BatchRecord = { batchId: 'BATCH-0001', workOrderId: 'WO-1001', lineId: 'LINE-A' };

describe('currentStation (max index reached, never backward)', () => {
  it('is null when the batch has no events', () => {
    expect(currentStation([])).toBeNull();
  });

  it('is the highest-index station present', () => {
    const events = [ce(Station.RECEIVING), ce(Station.WASHING), ce(Station.SORTING)];
    expect(currentStation(events)).toBe(Station.WASHING);
  });

  it('does not move backward when an earlier station arrives late', () => {
    const events = [
      ce(Station.DRYING, { eventTime: mins(20) }),
      ce(Station.SORTING, { eventTime: mins(5), late: true }),
    ];
    expect(currentStation(events)).toBe(Station.DRYING);
  });
});

describe('computeState (strict COMPLETED→BLOCKED→IN_PROGRESS→PLANNED order)', () => {
  it('is PLANNED with no events and no actions', () => {
    expect(computeState([], [])).toBe(BatchState.PLANNED);
  });

  it('is IN_PROGRESS with at least one RECEIVING..FOLDING event', () => {
    expect(computeState([ce(Station.SORTING)], [])).toBe(BatchState.IN_PROGRESS);
    expect(computeState([ce(Station.FOLDING)], [])).toBe(BatchState.IN_PROGRESS);
  });

  it('is COMPLETED once a DISPATCH event exists', () => {
    expect(computeState([ce(Station.FOLDING), ce(Station.DISPATCH)], [])).toBe(BatchState.COMPLETED);
  });

  it('is BLOCKED when the latest BLOCK/RESUME is a BLOCK, over IN_PROGRESS', () => {
    const events = [ce(Station.WASHING)];
    const management = [me(ManagementEventType.BLOCK, { createdAt: mins(5) })];
    expect(computeState(events, management)).toBe(BatchState.BLOCKED);
  });

  it('lets COMPLETED win even when a BLOCK is present (dispatch is terminal)', () => {
    const events = [ce(Station.DISPATCH)];
    const management = [me(ManagementEventType.BLOCK, { createdAt: mins(1) })];
    expect(computeState(events, management)).toBe(BatchState.COMPLETED);
  });
});

describe('isBlocked (latest BLOCK/RESUME wins)', () => {
  it('is false when a RESUME follows a BLOCK', () => {
    const management = [
      me(ManagementEventType.BLOCK, { createdAt: mins(20) }),
      me(ManagementEventType.RESUME, { createdAt: mins(5) }),
    ];
    expect(isBlocked(management)).toBe(false);
  });

  it('is true when a BLOCK follows a RESUME', () => {
    const management = [
      me(ManagementEventType.RESUME, { createdAt: mins(20) }),
      me(ManagementEventType.BLOCK, { createdAt: mins(5) }),
    ];
    expect(isBlocked(management)).toBe(true);
  });

  it('ignores ACKNOWLEDGE and NOTE actions entirely', () => {
    const management = [me(ManagementEventType.ACKNOWLEDGE), me(ManagementEventType.NOTE)];
    expect(isBlocked(management)).toBe(false);
  });

  it('breaks a same-timestamp tie deterministically by id (later id wins)', () => {
    const at = mins(7);
    const management = [
      me(ManagementEventType.RESUME, { id: 'm-a', createdAt: at }),
      me(ManagementEventType.BLOCK, { id: 'm-b', createdAt: at }),
    ];
    expect(isBlocked(management)).toBe(true); // 'm-b' > 'm-a'
  });
});

describe('freshness (vs stale threshold)', () => {
  it('reports no last event for an empty batch', () => {
    expect(freshness([], NOW, THRESHOLD)).toEqual({
      lastEventTime: null,
      minutesSinceLastEvent: null,
      stale: false,
    });
  });

  it('is fresh within the threshold, off the most recent cell', () => {
    const events = [ce(Station.RECEIVING, { eventTime: mins(50) }), ce(Station.SORTING, { eventTime: mins(5) })];
    const view = freshness(events, NOW, THRESHOLD);
    expect(view.lastEventTime).toEqual(mins(5));
    expect(view.minutesSinceLastEvent).toBe(5);
    expect(view.stale).toBe(false);
  });

  it('is stale past the threshold', () => {
    const view = freshness([ce(Station.WASHING, { eventTime: mins(50) })], NOW, THRESHOLD);
    expect(view.minutesSinceLastEvent).toBe(50);
    expect(view.stale).toBe(true);
  });

  it('treats exactly-threshold as fresh (strictly greater is stale)', () => {
    const view = freshness([ce(Station.WASHING, { eventTime: mins(15) })], NOW, THRESHOLD);
    expect(view.stale).toBe(false);
  });

  it('lastEventTime picks the maximum event time', () => {
    const events = [ce(Station.RECEIVING, { eventTime: mins(90) }), ce(Station.DRYING, { eventTime: mins(14) })];
    expect(lastEventTime(events)).toEqual(mins(14));
  });
});

describe('hasMissingData (earlier station than current lacks an event)', () => {
  it('is false for a batch with no events', () => {
    expect(hasMissingData([])).toBe(false);
  });

  it('is false when every earlier station is present', () => {
    const events = [ce(Station.RECEIVING), ce(Station.SORTING), ce(Station.WASHING)];
    expect(hasMissingData(events)).toBe(false);
  });

  it('is true when an earlier station is missing below the current one', () => {
    const events = [ce(Station.RECEIVING), ce(Station.WASHING), ce(Station.DRYING)];
    expect(hasMissingData(events)).toBe(true);
  });

  it('is false when the current station is the first one', () => {
    expect(hasMissingData([ce(Station.RECEIVING)])).toBe(false);
  });
});

describe('indicators (stale / blocked / missingData / quality)', () => {
  it('flags all four when each condition holds', () => {
    const events = [
      ce(Station.RECEIVING, { eventTime: mins(50) }),
      ce(Station.WASHING, { eventTime: mins(60) }),
      ce(Station.DRYING, { eventTime: mins(50), conflictFlags: ['QUANTITY_MISMATCH'] }),
    ];
    const management = [me(ManagementEventType.BLOCK, { createdAt: mins(3) })];
    expect(indicators(events, management, NOW, THRESHOLD)).toEqual({
      stale: true,
      blocked: true,
      missingData: true,
      quality: true,
    });
  });

  it('flags nothing for a clean, fresh, complete batch', () => {
    const events = [ce(Station.RECEIVING, { eventTime: mins(10) }), ce(Station.SORTING, { eventTime: mins(5) })];
    expect(indicators(events, [], NOW, THRESHOLD)).toEqual({
      stale: false,
      blocked: false,
      missingData: false,
      quality: false,
    });
  });

  it('hasQualityConflict is true only when a cell carries a flag', () => {
    expect(hasQualityConflict([ce(Station.SORTING)])).toBe(false);
    expect(hasQualityConflict([ce(Station.SORTING, { conflictFlags: ['QUANTITY_MISMATCH'] })])).toBe(true);
  });
});

describe('computeBatchSummary (integration)', () => {
  it('summarizes a missing-data, in-progress batch (BATCH-0004 shape)', () => {
    const events = [
      ce(Station.RECEIVING, { batchId: 'BATCH-0004', eventTime: mins(60) }),
      ce(Station.WASHING, { batchId: 'BATCH-0004', quantity: 70, eventTime: mins(35) }),
      ce(Station.DRYING, { batchId: 'BATCH-0004', quantity: 70, eventTime: mins(14) }),
    ];
    const record: BatchRecord = { batchId: 'BATCH-0004', workOrderId: 'WO-1002', lineId: 'LINE-A' };
    const summary = computeBatchSummary(record, events, [], NOW, THRESHOLD);

    expect(summary).toMatchObject({
      batchId: 'BATCH-0004',
      workOrderId: 'WO-1002',
      lineId: 'LINE-A',
      state: BatchState.IN_PROGRESS,
      currentStation: Station.DRYING,
      currentQuantity: 70,
    });
    expect(summary.freshness.stale).toBe(false); // 14m < 15m
    expect(summary.indicators).toEqual({ stale: false, blocked: false, missingData: true, quality: false });
  });

  it('summarizes a completed, fresh batch (BATCH-0001 shape)', () => {
    const stations = [
      ce(Station.RECEIVING, { eventTime: mins(90) }),
      ce(Station.SORTING, { quantity: 100, eventTime: mins(75) }),
      ce(Station.WASHING, { quantity: 100, eventTime: mins(55) }),
      ce(Station.DRYING, { quantity: 100, eventTime: mins(35) }),
      ce(Station.FOLDING, { quantity: 100, eventTime: mins(18) }),
      ce(Station.DISPATCH, { quantity: 100, eventTime: mins(6) }),
    ];
    const summary = computeBatchSummary(batch, stations, [], NOW, THRESHOLD);

    expect(summary.state).toBe(BatchState.COMPLETED);
    expect(summary.currentStation).toBe(Station.DISPATCH);
    expect(summary.currentQuantity).toBe(100);
    expect(summary.indicators).toEqual({ stale: false, blocked: false, missingData: false, quality: false });
  });
});
