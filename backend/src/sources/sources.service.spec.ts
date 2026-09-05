import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { RunView } from '../collection/collection.types';
import type { CollectionService } from '../collection/collection.service';
import type { CollectorRegistry } from '../collectors/collector.registry';
import type { SourceCollector, TestResult } from '../collectors/collector.types';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../common/crypto/crypto';
import type { CryptoService } from '../common/crypto/crypto.service';
import { RunStatus, SourceStatus, SourceType } from '../common/domain/enums';
import type { Clock } from '../common/time/clock';
import type { NormalizationService } from '../normalization/normalization.service';
import type { NormalizationResult } from '../normalization/normalization.types';
import { SourcesService } from './sources.service';
import type { NewSource, SourceContextData, SourceView, SourcesStore } from './sources.types';

interface StoredRow {
  id: string;
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  status: SourceStatus;
  hasSecret: boolean;
  secret: EncryptedSecret | null;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakeSourcesStore implements SourcesStore {
  rows: StoredRow[] = [];
  private seq = 0;
  constructor(private readonly base = new Date('2026-09-03T09:00:00.000Z')) {}

  async existsByName(name: string): Promise<boolean> {
    return this.rows.some((r) => r.name === name);
  }
  async create(input: NewSource): Promise<SourceView> {
    this.seq += 1;
    const row: StoredRow = {
      id: `src-${this.seq}`,
      type: input.type,
      name: input.name,
      config: input.config,
      selection: input.selection,
      status: SourceStatus.REGISTERED,
      hasSecret: input.hasSecret,
      secret: input.secret,
      lastTestedAt: null,
      lastError: null,
      createdAt: this.base,
      updatedAt: this.base,
    };
    this.rows.push(row);
    return view(row);
  }
  async listViews(): Promise<SourceView[]> {
    return this.rows.map(view);
  }
  async loadView(id: string): Promise<SourceView | null> {
    const row = this.find(id);
    return row ? view(row) : null;
  }
  async loadContext(id: string): Promise<SourceContextData | null> {
    const row = this.find(id);
    return row ? { type: row.type, config: row.config, selection: row.selection, secret: row.secret } : null;
  }
  async updateSelection(id: string, selection: Record<string, unknown> | null): Promise<SourceView | null> {
    const row = this.find(id);
    if (!row) return null;
    row.selection = selection;
    return view(row);
  }
  async markTested(id: string, testedAt: Date, lastError: string | null): Promise<void> {
    const row = this.find(id);
    if (row) {
      row.lastTestedAt = testedAt;
      row.lastError = lastError;
      row.status = lastError ? SourceStatus.FAILED : SourceStatus.VERIFIED;
    }
  }
  private find(id: string): StoredRow | undefined {
    return this.rows.find((r) => r.id === id);
  }
}

function view(r: StoredRow): SourceView {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    config: r.config,
    selection: r.selection,
    status: r.status,
    hasSecret: r.hasSecret,
    lastTestedAt: r.lastTestedAt,
    lastError: r.lastError,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const KEY = Buffer.alloc(32, 7).toString('base64');
const crypto = {
  encrypt: (plaintext: string) => encryptSecret(plaintext, KEY),
  decrypt: (secret: EncryptedSecret) => decryptSecret(secret, KEY),
} as unknown as CryptoService;

function fakeClock(times: string[]): Clock {
  let i = 0;
  return { now: () => new Date(times[Math.min(i++, times.length - 1)]) };
}

function collectorWith(over: Partial<SourceCollector>): SourceCollector {
  return {
    type: SourceType.DATABASE,
    test: jest.fn(),
    discover: jest.fn(),
    collect: jest.fn(),
    ...over,
  } as unknown as SourceCollector;
}

function registryWith(collector: SourceCollector, has = true): CollectorRegistry {
  return { get: () => collector, has: () => has } as unknown as CollectorRegistry;
}

const RUN_VIEW: RunView = {
  id: 'run-1',
  sourceId: 'src-1',
  status: RunStatus.SUCCESS,
  startedAt: new Date('2026-09-03T10:00:00.000Z'),
  finishedAt: new Date('2026-09-03T10:00:00.500Z'),
  durationMs: 500,
  fetched: 5,
  normalized: 5,
  duplicates: 0,
  malformed: 0,
  errors: 0,
  trigger: 'manual',
};

const NORM_RESULT: NormalizationResult = {
  observationsConsidered: 5,
  canonicalEvents: 5,
  superseded: 0,
  conflicts: 0,
  lateEvents: 0,
};

const TESTED_AT = '2026-09-03T10:00:00.000Z';

interface SetupOpts {
  registered?: boolean;
  times?: string[];
  test?: TestResult;
}

function setup(opts: SetupOpts = {}) {
  const store = new FakeSourcesStore();
  const test = jest.fn(async () => opts.test ?? { ok: true, message: 'reachable' });
  const discover = jest.fn(async () => ({ entities: [{ name: 'production_events', kind: 'table' as const, produces: 'observations' as const }] }));
  const collector = collectorWith({ test, discover });
  const registry = registryWith(collector, opts.registered ?? true);
  const collect = jest.fn(async () => RUN_VIEW);
  const normalize = jest.fn(async () => NORM_RESULT);
  const collection = { collect } as unknown as CollectionService;
  const normalization = { normalize } as unknown as NormalizationService;
  const clock = fakeClock(opts.times ?? [TESTED_AT]);
  const svc = new SourcesService(store, registry, crypto, collection, normalization, clock);
  return { svc, store, test, discover, collect, normalize };
}

const dbInput = (over: Record<string, unknown> = {}) => ({
  type: SourceType.DATABASE,
  name: 'Factory DB',
  config: { host: 'db.internal', database: 'factory', user: 'factory_readonly' },
  selection: { schema: 'public', table: 'production_events' },
  secret: 'pg-pass-42',
  ...over,
});

describe('SourcesService - register + secret handling', () => {
  it('encrypts the secret at rest, returns hasSecret only, and never surfaces the plaintext', async () => {
    const { svc, store } = setup();
    const registered = await svc.register(dbInput());

    expect(registered.hasSecret).toBe(true);
    expect(JSON.stringify(registered)).not.toContain('pg-pass-42');
    expect(registered).not.toHaveProperty('secret');

\    const row = store.rows[0];
    expect(row.secret).not.toBeNull();
    expect(JSON.stringify(row.secret)).not.toContain('pg-pass-42');
    expect(decryptSecret(row.secret as EncryptedSecret, KEY)).toBe('pg-pass-42');
  });

  it('a subsequent GET / LIST never exposes the secret, only hasSecret', async () => {
    const { svc } = setup();
    const registered = await svc.register(dbInput({ secret: 'top-secret-pw' }));

    const fetched = await svc.get(registered.id);
    const listed = await svc.list();

    expect(fetched.hasSecret).toBe(true);
    expect(JSON.stringify(fetched)).not.toContain('top-secret-pw');
    expect(JSON.stringify(listed)).not.toContain('top-secret-pw');
  });

  it('registers a secret-free source (API) with hasSecret=false and no stored secret', async () => {
    const { svc, store } = setup();
    const registered = await svc.register({
      type: SourceType.API,
      name: 'App API',
      config: { baseUrl: 'http://fixtures:4000' },
      selection: null,
      secret: null,
    });

    expect(registered.hasSecret).toBe(false);
    expect(store.rows[0].secret).toBeNull();
  });

  it('treats an empty-string secret as no secret', async () => {
    const { svc, store } = setup();
    await svc.register(dbInput({ secret: '' }));
    expect(store.rows[0].hasSecret).toBe(false);
    expect(store.rows[0].secret).toBeNull();
  });

  it('rejects a duplicate name with 409 and does not create a second source', async () => {
    const { svc, store } = setup();
    await svc.register(dbInput({ name: 'dup' }));
    await expect(svc.register(dbInput({ name: 'dup' }))).rejects.toBeInstanceOf(ConflictException);
    expect(store.rows).toHaveLength(1);
  });

  it('rejects an unsupported source type with 400 (no collector registered)', async () => {
    const { svc, store } = setup({ registered: false });
    await expect(svc.register(dbInput({ type: 'SFTP' as SourceType }))).rejects.toBeInstanceOf(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });
});

describe('SourcesService - test', () => {
  it('decrypts the secret in-memory, hands it to the collector, and records a passing outcome', async () => {
    const { svc, store, test } = setup({ times: [TESTED_AT] });
    const registered = await svc.register(dbInput());

    const result = await svc.test(registered.id);

    expect(result).toEqual({ ok: true, message: 'reachable' });
    const ctx = (test as jest.Mock).mock.calls[0][0];
    expect(ctx.secret).toBe('pg-pass-42'); // decrypted plaintext handed to the collector
    expect(ctx.config).toEqual({ host: 'db.internal', database: 'factory', user: 'factory_readonly' });
    expect(ctx.selection).toEqual({ schema: 'public', table: 'production_events' });

    expect(store.rows[0].lastTestedAt).toEqual(new Date(TESTED_AT));
    expect(store.rows[0].lastError).toBeNull();
    expect(store.rows[0].status).toBe(SourceStatus.VERIFIED);
  });

  it('records a failing test as lastError (and marks the source failed)', async () => {
    const { svc, store } = setup({ test: { ok: false, message: 'authentication failed' } });
    const registered = await svc.register(dbInput());

    const result = await svc.test(registered.id);

    expect(result.ok).toBe(false);
    expect(store.rows[0].lastError).toBe('authentication failed');
    expect(store.rows[0].status).toBe(SourceStatus.FAILED);
  });

  it('404s for an unknown source', async () => {
    const { svc } = setup();
    await expect(svc.test('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SourcesService - discover', () => {
  it('decrypts the secret and returns the collector catalogue', async () => {
    const { svc, discover } = setup();
    const registered = await svc.register(dbInput());

    const result = await svc.discover(registered.id);

    expect(result.entities[0]).toMatchObject({ name: 'production_events', kind: 'table' });
    expect((discover as jest.Mock).mock.calls[0][0].secret).toBe('pg-pass-42');
  });

  it('404s for an unknown source', async () => {
    const { svc } = setup();
    await expect(svc.discover('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SourcesService - selection', () => {
  it('replaces the selection and returns the updated view', async () => {
    const { svc } = setup();
    const registered = await svc.register(dbInput({ selection: null }));

    const updated = await svc.updateSelection(registered.id, { schema: 'public', table: 'production_events' });

    expect(updated.selection).toEqual({ schema: 'public', table: 'production_events' });
  });

  it('404s for an unknown source', async () => {
    const { svc } = setup();
    await expect(svc.updateSelection('nope', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SourcesService - collect', () => {
  it('runs collection then re-normalizes, returning the run', async () => {
    const { svc, collect, normalize } = setup();
    const registered = await svc.register(dbInput());

    const run = await svc.collect(registered.id);

    expect(run).toBe(RUN_VIEW);
    expect(collect).toHaveBeenCalledWith(registered.id, 'manual');
    expect(normalize).toHaveBeenCalledTimes(1);
    const collectOrder = (collect as jest.Mock).mock.invocationCallOrder[0];
    const normalizeOrder = (normalize as jest.Mock).mock.invocationCallOrder[0];
    expect(collectOrder).toBeLessThan(normalizeOrder);
  });

  it('404s for an unknown source without collecting or normalizing', async () => {
    const { svc, collect, normalize } = setup();
    await expect(svc.collect('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(collect).not.toHaveBeenCalled();
    expect(normalize).not.toHaveBeenCalled();
  });
});
