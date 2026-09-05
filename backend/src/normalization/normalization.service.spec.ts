import { CanonicalStatus, SourceType } from '../common/domain/enums';
import { Station, stationIndex } from '../common/domain/station';
import type { Clock } from '../common/time/clock';
import { NormalizationService } from './normalization.service';
import { ConflictFlag, compareObservations } from './normalization.policy';
import type { CanonicalEventInput, NormalizationStore, ObservationRecord } from './normalization.types';

// in-memory fake store

class FakeStore implements NormalizationStore {
  observations: ObservationRecord[] = [];
  replaced: CanonicalEventInput[] | null = null;
  replaceCalls = 0;

  async loadObservations(): Promise<ObservationRecord[]> {
    return this.observations;
  }
  async replaceCanonical(events: CanonicalEventInput[]): Promise<void> {
    this.replaced = events;
    this.replaceCalls += 1;
  }
}

// fixtures

const NOW = new Date('2026-09-03T12:00:00.000Z');
const mins = (n: number) => new Date(NOW.getTime() - n * 60_000);
const fixedClock: Clock = { now: () => NOW };

let seq = 0;
function ob(over: Partial<ObservationRecord> = {}): ObservationRecord {
  seq += 1;
  const base: ObservationRecord = {
    id: `obs-${seq}`,
    sourceId: 'src',
    sourceType: SourceType.DATABASE,
    runId: 'run',
    runStartedAt: new Date('2026-09-03T08:00:00.000Z'),
    sourceRecordId: `rec-${seq}`,
    station: Station.SORTING,
    batchId: 'BATCH-0001',
    quantity: null,
    eventTime: mins(30),
  };
  return { ...base, ...over };
}

function service(store: FakeStore): NormalizationService {
  return new NormalizationService(store, fixedClock);
}

function cell(events: CanonicalEventInput[], batchId: string, station: Station): CanonicalEventInput {
  const found = events.filter((e) => e.batchId === batchId && e.station === station);
  expect(found).toHaveLength(1);
  return found[0];
}

describe('NormalizationService', () => {
  it('dedups a cell by station-aware authority and supersedes the losers', async () => {
    const store = new FakeStore();
    // RECEIVING: CRAWLER outranks API. DISPATCH: API outranks DATABASE.
    const recvApi = ob({ id: 'recv-api', sourceType: SourceType.API, station: Station.RECEIVING, eventTime: mins(90) });
    const recvCrawler = ob({ id: 'recv-crawler', sourceType: SourceType.CRAWLER, station: Station.RECEIVING, eventTime: mins(90) });
    const dispDb = ob({ id: 'disp-db', sourceType: SourceType.DATABASE, station: Station.DISPATCH, quantity: 100, eventTime: mins(6) });
    const dispApi = ob({ id: 'disp-api', sourceType: SourceType.API, station: Station.DISPATCH, quantity: 100, eventTime: mins(6) });
    store.observations = [recvApi, recvCrawler, dispDb, dispApi];

    const result = await service(store).normalize();
    const events = store.replaced!;

    const recv = cell(events, 'BATCH-0001', Station.RECEIVING);
    expect(recv.winningObservationId).toBe('recv-crawler');
    expect(recv.sourceType).toBe(SourceType.CRAWLER);
    expect(recv.supersededObservationIds).toEqual(['recv-api']);
    expect(recv.status).toBe(CanonicalStatus.ACCEPTED);
    expect(recv.computedAt).toEqual(NOW);

    const disp = cell(events, 'BATCH-0001', Station.DISPATCH);
    expect(disp.winningObservationId).toBe('disp-api'); 
    expect(disp.supersededObservationIds).toEqual(['disp-db']);

    expect(store.replaceCalls).toBe(1);
    expect(result).toMatchObject({ observationsConsidered: 4, canonicalEvents: 2, superseded: 2, conflicts: 0, lateEvents: 0 });
  });

  it('raises no conflict when duplicates agree, and counts the quantity once per cell', async () => {
    const store = new FakeStore();
    store.observations = [
      ob({ id: 'd1', sourceType: SourceType.API, station: Station.DISPATCH, quantity: 100, eventTime: mins(6) }),
      ob({ id: 'd2', sourceType: SourceType.DATABASE, station: Station.DISPATCH, quantity: 100, eventTime: mins(6) }),
    ];

    await service(store).normalize();
    const events = store.replaced!;
    const disp = cell(events, 'BATCH-0001', Station.DISPATCH);

    expect(disp.quantity).toBe(100);
    expect(disp.conflictFlags).toEqual([]);
    const total = events.filter((e) => e.batchId === 'BATCH-0001').reduce((n, e) => n + (e.quantity ?? 0), 0);
    expect(total).toBe(100);
  });

  it('flags a quantity mismatch and lets the later event win', async () => {
    const store = new FakeStore();
    store.observations = [
      ob({ id: 's-60', station: Station.SORTING, batchId: 'BATCH-0002', quantity: 60, sourceRecordId: 'SORT-1', eventTime: mins(65) }),
      ob({ id: 's-58', station: Station.SORTING, batchId: 'BATCH-0002', quantity: 58, sourceRecordId: 'SORT-2', eventTime: mins(64) }),
    ];

    const result = await service(store).normalize();
    const sort = cell(store.replaced!, 'BATCH-0002', Station.SORTING);

    expect(sort.winningObservationId).toBe('s-58'); 
    expect(sort.quantity).toBe(58); 
    expect(sort.conflictFlags).toEqual([ConflictFlag.QUANTITY_MISMATCH]);
    expect(sort.supersededObservationIds).toEqual(['s-60']);
    expect(result.conflicts).toBe(1);
  });

  it('flags a late earlier-station event without disturbing downstream cells or current station', async () => {
    const store = new FakeStore();
    store.observations = [
      ob({ id: 'sort', station: Station.SORTING, batchId: 'BATCH-0003', eventTime: mins(30) }),
      ob({ id: 'wash', station: Station.WASHING, batchId: 'BATCH-0003', eventTime: mins(40) }),
      ob({ id: 'dry', station: Station.DRYING, batchId: 'BATCH-0003', eventTime: mins(10) }),
    ];

    const result = await service(store).normalize();
    const events = store.replaced!;

    expect(cell(events, 'BATCH-0003', Station.SORTING).late).toBe(true);
    expect(cell(events, 'BATCH-0003', Station.WASHING).late).toBe(false);
    expect(cell(events, 'BATCH-0003', Station.DRYING).late).toBe(false);

    expect(cell(events, 'BATCH-0003', Station.SORTING).eventTime).toEqual(mins(30));
    const maxIndex = Math.max(...events.map((e) => stationIndex(e.station)));
    expect(maxIndex).toBe(stationIndex(Station.DRYING));
    expect(result.lateEvents).toBe(1);
  });

  it('emits events sorted by batch then station index', async () => {
    const store = new FakeStore();
    store.observations = [
      ob({ id: 'b2-dry', batchId: 'BATCH-0002', station: Station.DRYING, eventTime: mins(5) }),
      ob({ id: 'b1-recv', batchId: 'BATCH-0001', station: Station.RECEIVING, sourceType: SourceType.CRAWLER, eventTime: mins(90) }),
      ob({ id: 'b1-wash', batchId: 'BATCH-0001', station: Station.WASHING, eventTime: mins(40) }),
    ];

    await service(store).normalize();
    const order = store.replaced!.map((e) => `${e.batchId}:${e.station}`);
    expect(order).toEqual(['BATCH-0001:RECEIVING', 'BATCH-0001:WASHING', 'BATCH-0002:DRYING']);
  });

  it('replaces the canonical set with nothing when there are no observations', async () => {
    const store = new FakeStore();
    store.observations = [];

    const result = await service(store).normalize();

    expect(store.replaceCalls).toBe(1);
    expect(store.replaced).toEqual([]);
    expect(result).toEqual({ observationsConsidered: 0, canonicalEvents: 0, superseded: 0, conflicts: 0, lateEvents: 0 });
  });
});

describe('compareObservations (dedup policy order)', () => {
  const a = (over: Partial<ObservationRecord>) => ob(over);

  it('prefers the more authoritative source for the station', () => {
    const api = a({ sourceType: SourceType.API, station: Station.DISPATCH });
    const db = a({ sourceType: SourceType.DATABASE, station: Station.DISPATCH });
    expect(compareObservations(api, db, Station.DISPATCH)).toBeLessThan(0); // API wins DISPATCH
    expect(compareObservations(db, api, Station.DISPATCH)).toBeGreaterThan(0);
    const crawler = a({ sourceType: SourceType.CRAWLER, station: Station.RECEIVING });
    const apiRecv = a({ sourceType: SourceType.API, station: Station.RECEIVING });
    expect(compareObservations(apiRecv, crawler, Station.RECEIVING)).toBeGreaterThan(0);
  });

  it('breaks an authority tie by later eventTime, then later run, then smaller record id', () => {
    const base = { sourceType: SourceType.DATABASE, station: Station.SORTING } as const;

    const later = a({ ...base, eventTime: mins(10) });
    const earlier = a({ ...base, eventTime: mins(20) });
    expect(compareObservations(later, earlier, Station.SORTING)).toBeLessThan(0);

    const newRun = a({ ...base, eventTime: mins(10), runStartedAt: mins(1) });
    const oldRun = a({ ...base, eventTime: mins(10), runStartedAt: mins(5) });
    expect(compareObservations(newRun, oldRun, Station.SORTING)).toBeLessThan(0);

    const lowId = a({ ...base, eventTime: mins(10), runStartedAt: mins(1), sourceRecordId: 'AAA' });
    const highId = a({ ...base, eventTime: mins(10), runStartedAt: mins(1), sourceRecordId: 'ZZZ' });
    expect(compareObservations(lowId, highId, Station.SORTING)).toBeLessThan(0);
  });

  it('ranks an observation with no run start time below one that has it', () => {
    const withRun = a({ sourceType: SourceType.DATABASE, station: Station.SORTING, eventTime: mins(10), runStartedAt: mins(1) });
    const noRun = a({ sourceType: SourceType.DATABASE, station: Station.SORTING, eventTime: mins(10), runStartedAt: null });
    expect(compareObservations(withRun, noRun, Station.SORTING)).toBeLessThan(0);
  });
});
