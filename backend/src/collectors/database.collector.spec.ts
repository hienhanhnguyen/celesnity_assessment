import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import { DatabaseCollector, type PgClientFactory, type PgConnectionConfig } from './database.collector';
import type { SourceContext } from './collector.types';

type Row = Record<string, unknown>;

interface Canned {
  tables: string[];
  columns: Record<string, string[]>;
  rowsByTable: Record<string, Row[]>;
}

interface QueryLog {
  connected: number;
  queries: string[];
  lastConn?: PgConnectionConfig;
}

const CANNED: Canned = {
  tables: ['production_events', 'lines', 'machines'],
  columns: {
    production_events: [
      'event_id',
      'batch_id',
      'work_order_id',
      'line_id',
      'station',
      'event_type',
      'quantity',
      'event_time',
    ],
    lines: ['line_id', 'name', 'location'],
    machines: ['machine_id', 'line_id', 'station', 'model'],
  },
  rowsByTable: {
    production_events: [
      pe(1, 'BATCH-0001', 'LINE-A', 'SORTING', 'SORTING_COMPLETED', 100, 75),
      pe(2, 'BATCH-0001', 'LINE-A', 'WASHING', 'WASHING_COMPLETED', 100, 55),
      pe(3, 'BATCH-0001', 'LINE-A', 'DISPATCH', 'DISPATCH_ACCEPTED', 100, 6),
      pe(4, 'BATCH-0002', 'LINE-A', 'SORTING', 'SORTING_COMPLETED', 60, 65),
      // A row with a station outside the six steps
      pe(5, 'BATCH-0002', 'LINE-A', 'BOGUS', 'WAT', 1, 1),
    ],
  },
};

function pe(
  eventId: number,
  batchId: string,
  lineId: string,
  station: string,
  eventType: string,
  quantity: number,
  minutesAgo: number,
): Row {
  return {
    event_id: String(eventId), // node-pg returns bigint as string
    batch_id: batchId,
    work_order_id: null,
    line_id: lineId,
    station,
    event_type: eventType,
    quantity,
    event_time: new Date(Date.UTC(2026, 8, 1, 12, 0, 0) - minutesAgo * 60_000),
  };
}

function fakeFactory(canned: Canned, log: QueryLog, hooks: { onConnect?: () => void } = {}): PgClientFactory {
  return {
    create(conn) {
      log.lastConn = conn;
      return {
        async connect() {
          log.connected += 1;
          hooks.onConnect?.();
        },
        async query(text: string, params?: unknown[]) {
          log.queries.push(text);
          const p = (params ?? []) as unknown[];

          if (text.trim() === 'SELECT 1') return { rows: [{ ok: 1 }] };

          if (/information_schema\.tables/.test(text) && /table_name = \$2/.test(text)) {
            const table = String(p[1]);
            return { rows: canned.tables.includes(table) ? [{ exists: 1 }] : [] };
          }
          if (/information_schema\.tables/.test(text)) {
            return { rows: canned.tables.map((t) => ({ table_name: t })) };
          }
          if (/information_schema\.columns/.test(text)) {
            const rows: Row[] = [];
            for (const t of canned.tables) {
              for (const c of canned.columns[t] ?? []) rows.push({ table_name: t, column_name: c });
            }
            return { rows };
          }
          const m = text.match(/FROM "(\w+)"\."(\w+)"/);
          if (m) {
            const all = canned.rowsByTable[m[2]] ?? [];
            const limit = Number(p[0]);
            const offset = Number(p[1]);
            return { rows: all.slice(offset, offset + limit) };
          }
          return { rows: [] };
        },
        async end() {},
      };
    },
  };
}

const baseCtx = (selection?: Record<string, unknown>): SourceContext => ({
  config: { host: 'db.test', port: 5432, database: 'factory', user: 'factory_readonly' },
  selection: selection ?? null,
  secret: 'factory_readonly_pw',
});

function freshLog(): QueryLog {
  return { connected: 0, queries: [] };
}

describe('DatabaseCollector', () => {
  it('is the DATABASE source type', () => {
    expect(new DatabaseCollector().type).toBe(SourceType.DATABASE);
  });

  it('discovers tables and their columns via information_schema', async () => {
    const log = freshLog();
    const collector = new DatabaseCollector(fakeFactory(CANNED, log));
    const { entities } = await collector.discover(baseCtx());

    expect(entities.map((e) => e.name)).toEqual(['production_events', 'lines', 'machines']);
    const events = entities.find((e) => e.name === 'production_events');
    expect(events?.kind).toBe('table');
    expect(events?.fields).toContain('batch_id');
    expect(log.connected).toBe(1);
  });

  it('maps the selected table rows to observations and flags unmappable rows', async () => {
    const log = freshLog();
    const collector = new DatabaseCollector(fakeFactory(CANNED, log));
    const result = await collector.collect(baseCtx());

    expect(result.observations).toHaveLength(4);
    expect(result.stats.malformed).toBe(1);
    expect(result.errors[0].kind).toBe(CollectionErrorKind.MALFORMED_ROW);

    const first = result.observations[0];
    expect(first.sourceRecordId).toBe('1');
    expect(first.batchId).toBe('BATCH-0001');
    expect(first.station).toBe(Station.SORTING);
    expect(first.workOrderId).toBeNull();
    expect(first.quantity).toBe(100);
    expect(first.eventTime).toBeInstanceOf(Date);

    expect(result.observations.some((o) => o.station === Station.DISPATCH)).toBe(true);
  });

  it('paginates via LIMIT/OFFSET until a short page', async () => {
    const log = freshLog();
    const collector = new DatabaseCollector(fakeFactory(CANNED, log));
    const result = await collector.collect(baseCtx({ pageSize: 2 }));

    expect(result.stats.pagesFetched).toBe(3);
    expect(result.observations.length + result.stats.malformed).toBe(5);
  });

  it('injection guard (syntactic): rejects a non-identifier table before connecting', async () => {
    const log = freshLog();
    const collector = new DatabaseCollector(fakeFactory(CANNED, log));

    await expect(
      collector.collect(baseCtx({ table: 'production_events; DROP TABLE lines' })),
    ).rejects.toThrow(/Invalid SQL table/);

    expect(log.connected).toBe(0);
    expect(log.queries).toHaveLength(0);
  });

  it('injection guard (allowlist): rejects a well-formed name that is not a real table', async () => {
    const log = freshLog();
    const collector = new DatabaseCollector(fakeFactory(CANNED, log));

    await expect(collector.collect(baseCtx({ table: 'secret_table' }))).rejects.toThrow(
      /not found or is not selectable/,
    );

    expect(log.connected).toBe(1);
    expect(log.queries.some((q) => /FROM "public"\."secret_table"/.test(q))).toBe(false);
  });

  it('never leaks the password in a failed test() message', async () => {
    const log = freshLog();
    const factory = fakeFactory(CANNED, log, {
      onConnect: () => {
        throw new Error('password authentication failed for user; password=factory_readonly_pw');
      },
    });
    const collector = new DatabaseCollector(factory);
    const result = await collector.test(baseCtx());

    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('factory_readonly_pw');
    expect(result.message).toContain('***');
  });
});
