import { NotFoundException } from '@nestjs/common';
import type { CollectResult, RawObservation, SourceCollector } from '../collectors/collector.types';
import type { CollectorRegistry } from '../collectors/collector.registry';
import type { CryptoService } from '../common/crypto/crypto.service';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../common/crypto/crypto';
import { CollectionErrorKind, RunStatus, SourceStatus, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { Clock } from '../common/time/clock';
import { CollectionService } from './collection.service';
import type {
  CollectionStore,
  PersistBatch,
  RunPatch,
  RunView,
  StoredSource,
} from './collection.types';

// in-memory fake store: records everything the service asks it to persist

class FakeStore implements CollectionStore {
  sources = new Map<string, StoredSource>();
  runs = new Map<string, RunView>();
  patches: Array<{ id: string; patch: RunPatch }> = [];
  persisted: PersistBatch[] = [];
  outcomes: Array<{ id: string; status: SourceStatus; lastError: string | null }> = [];
  failPersist = false;
  private seq = 0;

  async loadSource(id: string): Promise<StoredSource | null> {
    return this.sources.get(id) ?? null;
  }

  async createRun(sourceId: string, trigger: string | null): Promise<string> {
    const id = `run-${(this.seq += 1)}`;
    this.runs.set(id, {
      id,
      sourceId,
      status: RunStatus.PENDING,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      malformed: 0,
      errors: 0,
      trigger,
    });
    return id;
  }

  async patchRun(id: string, patch: RunPatch): Promise<void> {
    this.patches.push({ id, patch });
    const run = this.runs.get(id);
    if (run) Object.assign(run, patch);
  }

  async loadRun(id: string): Promise<RunView> {
    const run = this.runs.get(id);
    if (!run) throw new Error(`no run ${id}`);
    return run;
  }

  async persist(batch: PersistBatch): Promise<void> {
    if (this.failPersist) throw new Error('database unavailable');
    this.persisted.push(batch);
  }

  async updateSourceOutcome(id: string, status: SourceStatus, lastError: string | null): Promise<void> {
    this.outcomes.push({ id, status, lastError });
  }

  observations() {
    return this.persisted.flatMap((b) => b.observations);
  }
  errorRows() {
    return this.persisted.flatMap((b) => b.errors);
  }
  workOrderRows() {
    return this.persisted.flatMap((b) => b.workOrders);
  }
  batchRows() {
    return this.persisted.flatMap((b) => b.batches);
  }
}

// fakes for the collaborators 

const KEY = Buffer.alloc(32, 9).toString('base64');
const crypto = {
  encrypt: (plaintext: string) => encryptSecret(plaintext, KEY),
  decrypt: (secret: EncryptedSecret) => decryptSecret(secret, KEY),
} as unknown as CryptoService;

function fakeClock(times: string[]): Clock {
  let i = 0;
  return { now: () => new Date(times[Math.min(i++, times.length - 1)]) };
}

function registryOf(collector: SourceCollector): CollectorRegistry {
  return { get: () => collector } as unknown as CollectorRegistry;
}

function collectorReturning(result: CollectResult): SourceCollector {
  return {
    type: SourceType.DATABASE,
    test: jest.fn(),
    discover: jest.fn(),
    collect: jest.fn(async () => result),
  } as unknown as SourceCollector;
}

function collectorThrowing(err: Error): SourceCollector {
  return {
    type: SourceType.DATABASE,
    test: jest.fn(),
    discover: jest.fn(),
    collect: jest.fn(async () => {
      throw err;
    }),
  } as unknown as SourceCollector;
}

const TIMES = ['2026-09-03T08:00:00.000Z', '2026-09-03T08:00:00.250Z'];

function makeSource(over: Partial<StoredSource> = {}): StoredSource {
  return {
    id: 'src-1',
    type: SourceType.DATABASE,
    config: { host: 'db.internal' },
    selection: null,
    hasSecret: false,
    secret: null,
    ...over,
  };
}

const eventTime = (min: number) => new Date(Date.UTC(2026, 8, 3, 7, 0, 0) - min * 60_000);

function obs(id: string, station: Station, batchId: string, over: Partial<RawObservation> = {}): RawObservation {
  return {
    sourceRecordId: id,
    station,
    batchId,
    workOrderId: null,
    lineId: 'LINE-A',
    quantity: 100,
    eventType: 'EVENT',
    eventTime: eventTime(10),
    rawPayload: { id },
    ...over,
  };
}

function service(store: FakeStore, collector: SourceCollector, times = TIMES): CollectionService {
  return new CollectionService(store, registryOf(collector), crypto, fakeClock(times));
}

describe('CollectionService', () => {
  it('runs a clean source to SUCCESS with accurate counts, timing, and provenance', async () => {
    const store = new FakeStore();
    store.sources.set('src-1', makeSource());
    const result: CollectResult = {
      observations: [obs('RCV-1', Station.RECEIVING, 'B1'), obs('DSP-1', Station.DISPATCH, 'B1')],
      references: {
        workOrders: [{ workOrderId: 'WO-1', lineId: 'LINE-A', status: 'IN_PROGRESS', metadata: {} }],
        batches: [{ batchId: 'B1', workOrderId: 'WO-1', lineId: 'LINE-A', metadata: {} }],
      },
      errors: [],
      stats: { fetched: 4, pagesFetched: 3, malformed: 0 }, // fetched counts refs (1+1) + obs (2)
    };

    const run = await service(store, collectorReturning(result)).collect('src-1');

    expect(run.status).toBe(RunStatus.SUCCESS);
    expect(run).toMatchObject({ fetched: 4, normalized: 2, duplicates: 0, malformed: 0, errors: 0 });

    expect(run.startedAt).toEqual(new Date(TIMES[0]));
    expect(run.finishedAt).toEqual(new Date(TIMES[1]));
    expect(run.durationMs).toBe(250);

    expect(store.patches[0].patch.status).toBe(RunStatus.RUNNING);
    expect(store.patches[0].patch.startedAt).toEqual(new Date(TIMES[0]));
    expect(store.patches.at(-1)?.patch.status).toBe(RunStatus.SUCCESS);

    expect(store.observations()).toHaveLength(2);
    expect(store.observations()[0]).toMatchObject({
      runId: run.id,
      sourceId: 'src-1',
      sourceRecordId: 'RCV-1',
      station: Station.RECEIVING,
      batchId: 'B1',
    });

    expect(store.workOrderRows()).toEqual([
      { workOrderId: 'WO-1', lineId: 'LINE-A', status: 'IN_PROGRESS', metadata: {} },
    ]);
    expect(store.batchRows().map((b) => b.batchId)).toEqual(['B1']);

    expect(store.outcomes).toContainEqual({ id: 'src-1', status: SourceStatus.VERIFIED, lastError: null });
  });

  it('marks a run PARTIAL when the collector reports non-fatal errors, keeping the good rows', async () => {
    const store = new FakeStore();
    store.sources.set('src-1', makeSource());
    const result: CollectResult = {
      observations: [obs('RCV-1', Station.RECEIVING, 'B1')],
      errors: [
        { kind: CollectionErrorKind.MALFORMED_ROW, message: 'blank batch cell', context: { page: 2 } },
      ],
      stats: { fetched: 2, pagesFetched: 1, malformed: 1 },
    };

    const run = await service(store, collectorReturning(result)).collect('src-1');

    expect(run.status).toBe(RunStatus.PARTIAL);
    expect(run).toMatchObject({ normalized: 1, malformed: 1, errors: 1 });
    expect(store.observations()).toHaveLength(1);
    expect(store.errorRows()).toHaveLength(1);
    expect(store.errorRows()[0].kind).toBe(CollectionErrorKind.MALFORMED_ROW);
    expect(store.outcomes.at(-1)).toEqual({ id: 'src-1', status: SourceStatus.VERIFIED, lastError: null });
  });

  it('marks a run FAILED when the collector throws, recording a redacted error (no secret leak)', async () => {
    const store = new FakeStore();
    store.sources.set('src-1', makeSource({ hasSecret: true, secret: crypto.encrypt('sup3r-secret') }));
    const err = new Error('connection to db.internal failed: password=sup3r-secret');

    const run = await service(store, collectorThrowing(err)).collect('src-1');

    expect(run.status).toBe(RunStatus.FAILED);
    expect(run).toMatchObject({ fetched: 0, normalized: 0, duplicates: 0, malformed: 0, errors: 1 });

    expect(store.errorRows()).toHaveLength(1);
    const recorded = store.errorRows()[0];
    expect(recorded.kind).toBe(CollectionErrorKind.CONNECTION);
    expect(recorded.message).not.toContain('sup3r-secret');
    expect(recorded.message).toContain('***');

    const failure = store.outcomes.find((o) => o.status === SourceStatus.FAILED);
    expect(failure?.lastError).not.toContain('sup3r-secret');
    expect(failure?.lastError).toContain('***');
  });

  it('decrypts the secret in-memory, hands it to the collector, and never persists it', async () => {
    const store = new FakeStore();
    const plaintext = 'db-pass-9f3a';
    store.sources.set('src-1', makeSource({ hasSecret: true, secret: crypto.encrypt(plaintext) }));
    const collector = collectorReturning({
      observations: [obs('R1', Station.SORTING, 'B1')],
      errors: [],
      stats: { fetched: 1, pagesFetched: 1, malformed: 0 },
    });

    await service(store, collector).collect('src-1');

    const ctx = (collector.collect as jest.Mock).mock.calls[0][0];
    expect(ctx.secret).toBe(plaintext);

    const dump = JSON.stringify({
      persisted: store.persisted,
      outcomes: store.outcomes,
      runs: [...store.runs.values()],
    });
    expect(dump).not.toContain(plaintext);
  });

  it('counts within-run duplicates once and keeps the first (never mutating an observation)', async () => {
    const store = new FakeStore();
    store.sources.set('src-1', makeSource());
    const result: CollectResult = {
      observations: [
        obs('DUP', Station.WASHING, 'B1', { quantity: 100 }),
        obs('DUP', Station.WASHING, 'B1', { quantity: 999 }), // same (recordId, station)
      ],
      errors: [],
      stats: { fetched: 2, pagesFetched: 1, malformed: 0 },
    };

    const run = await service(store, collectorReturning(result)).collect('src-1');

    expect(run.normalized).toBe(1);
    expect(run.duplicates).toBe(1);
    expect(store.observations()).toHaveLength(1);
    expect(store.observations()[0].quantity).toBe(100); // the first one won
  });

  it('skips reference rows that cannot satisfy the reference tables', async () => {
    const store = new FakeStore();
    store.sources.set('src-1', makeSource());
    const result: CollectResult = {
      observations: [],
      references: {
        workOrders: [
          { workOrderId: 'WO-1', lineId: 'LINE-A', status: null, metadata: {} },
          { workOrderId: 'WO-2', lineId: null, status: null, metadata: {} }, // no line → skip
        ],
        batches: [
          { batchId: 'B1', workOrderId: 'WO-1', lineId: 'LINE-A', metadata: {} },
          { batchId: 'B2', workOrderId: null, lineId: 'LINE-A', metadata: {} }, // no WO → skip
          { batchId: 'B3', workOrderId: 'WO-1', lineId: null, metadata: {} }, // no line → skip
        ],
      },
      errors: [],
      stats: { fetched: 5, pagesFetched: 2, malformed: 0 },
    };

    await service(store, collectorReturning(result)).collect('src-1');

    expect(store.workOrderRows().map((w) => w.workOrderId)).toEqual(['WO-1']);
    expect(store.batchRows().map((b) => b.batchId)).toEqual(['B1']);
  });

  it('throws NotFound for an unknown source without creating a run', async () => {
    const store = new FakeStore();
    const collector = collectorReturning({
      observations: [],
      errors: [],
      stats: { fetched: 0, pagesFetched: 0, malformed: 0 },
    });

    await expect(service(store, collector).collect('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(store.runs.size).toBe(0);
    expect(store.persisted).toHaveLength(0);
    expect(collector.collect).not.toHaveBeenCalled();
  });
});
