import { Client } from 'pg';
import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station, isStation } from '../common/domain/station';
import {
  assertValidIdentifier,
  describeError,
  optionalNumber,
  optionalString,
  quoteIdentifier,
  requireString,
} from './util';
import type {
  CollectResult,
  CollectorError,
  DiscoverResult,
  RawObservation,
  SourceCollector,
  SourceContext,
  TestResult,
} from './collector.types';

export interface PgConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

export interface PgQueryResult {
  rows: Array<Record<string, unknown>>;
}

export interface PgLikeClient {
  connect(): Promise<void>;
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
  end(): Promise<void>;
}

export interface PgClientFactory {
  create(conn: PgConnectionConfig): PgLikeClient;
}

export const defaultPgFactory: PgClientFactory = {
  create(conn) {
    const client = new Client({
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
      ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: conn.connectionTimeoutMillis ?? 5000,
      statement_timeout: conn.statementTimeoutMillis ?? 15000,
      application_name: 'celesnity-collector',
    });
    return {
      async connect() {
        await client.connect();
      },
      async query(text, params) {
        const result = await client.query(text, params);
        return { rows: result.rows as Array<Record<string, unknown>> };
      },
      async end() {
        await client.end();
      },
    };
  },
};

const DEFAULT_SCHEMA = 'public';
const DEFAULT_TABLE = 'production_events';
const DEFAULT_PAGE_SIZE = 500;
const MAX_ROWS = 1_000_000;

interface ColumnMap {
  sourceRecordId: string;
  station: string;
  batchId: string;
  workOrderId: string;
  lineId: string;
  quantity: string;
  eventType: string;
  eventTime: string;
}

const DEFAULT_COLUMN_MAP: ColumnMap = {
  sourceRecordId: 'event_id',
  station: 'station',
  batchId: 'batch_id',
  workOrderId: 'work_order_id',
  lineId: 'line_id',
  quantity: 'quantity',
  eventType: 'event_type',
  eventTime: 'event_time',
};

export class DatabaseCollector implements SourceCollector {
  readonly type = SourceType.DATABASE;

  constructor(private readonly pg: PgClientFactory = defaultPgFactory) {}

  async test(ctx: SourceContext): Promise<TestResult> {
    const conn = buildConnection(ctx);
    const client = this.pg.create(conn);
    try {
      await client.connect();
      await client.query('SELECT 1');
      return { ok: true, message: `Connected to ${conn.database} as ${conn.user}` };
    } catch (err) {
      return { ok: false, message: describeError(err) };
    } finally {
      await safeEnd(client);
    }
  }

  async discover(ctx: SourceContext): Promise<DiscoverResult> {
    const conn = buildConnection(ctx);
    const schema =
      optionalString(ctx.selection, 'schema') ?? optionalString(ctx.config, 'schema') ?? DEFAULT_SCHEMA;
    const client = this.pg.create(conn);
    try {
      await client.connect();
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema],
      );
      const columns = await client.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, ordinal_position`,
        [schema],
      );
      const fieldsByTable = new Map<string, string[]>();
      for (const row of columns.rows) {
        const table = String(row.table_name);
        const list = fieldsByTable.get(table) ?? [];
        list.push(String(row.column_name));
        fieldsByTable.set(table, list);
      }
      return {
        entities: tables.rows.map((row) => {
          const name = String(row.table_name);
          return {
            name,
            kind: 'table' as const,
            produces: 'observations' as const,
            fields: fieldsByTable.get(name) ?? [],
          };
        }),
      };
    } finally {
      await safeEnd(client);
    }
  }

  async collect(ctx: SourceContext): Promise<CollectResult> {
    const conn = buildConnection(ctx);
    const schema =
      optionalString(ctx.selection, 'schema') ?? optionalString(ctx.config, 'schema') ?? DEFAULT_SCHEMA;
    const table =
      optionalString(ctx.selection, 'table') ?? optionalString(ctx.config, 'table') ?? DEFAULT_TABLE;
    const pageSize =
      optionalNumber(ctx.selection, 'pageSize') ?? optionalNumber(ctx.config, 'pageSize') ?? DEFAULT_PAGE_SIZE;
    const columnMap: ColumnMap = { ...DEFAULT_COLUMN_MAP, ...readColumnMap(ctx.selection) };

    assertValidIdentifier(schema, 'schema');
    assertValidIdentifier(table, 'table');

    const client = this.pg.create(conn);
    const observations: RawObservation[] = [];
    const errors: CollectorError[] = [];
    let malformed = 0;
    let pagesFetched = 0;

    try {
      await client.connect();

      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
        [schema, table],
      );
      if (exists.rows.length === 0) {
        throw new Error(`Selected table "${schema}.${table}" was not found or is not selectable`);
      }

      const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      let offset = 0;
      for (;;) {
        const page = await client.query(
          `SELECT * FROM ${qualified} ORDER BY 1 LIMIT $1 OFFSET $2`,
          [pageSize, offset],
        );
        pagesFetched += 1;
        for (const row of page.rows) {
          const mapped = toObservation(row, columnMap, table);
          if (mapped.observation) observations.push(mapped.observation);
          if (mapped.error) {
            malformed += 1;
            errors.push(mapped.error);
          }
        }
        if (page.rows.length < pageSize) break;
        offset += pageSize;
        if (offset >= MAX_ROWS) {
          errors.push({
            kind: CollectionErrorKind.VALIDATION,
            message: `Stopped after ${MAX_ROWS} rows`,
            context: { schema, table },
          });
          break;
        }
      }
    } finally {
      await safeEnd(client);
    }

    return {
      observations,
      errors,
      stats: { fetched: observations.length + malformed, pagesFetched, malformed },
    };
  }
}

type RowResult = { observation?: RawObservation; error?: CollectorError };

function toObservation(
  row: Record<string, unknown>,
  map: ColumnMap,
  table: string,
): RowResult {
  const sourceRecordId = asString(row[map.sourceRecordId]);
  const batchId = asString(row[map.batchId]);
  const stationRaw = asString(row[map.station]);
  const eventTime = parseDate(row[map.eventTime]);

  if (!sourceRecordId || !batchId || !stationRaw || !isStation(stationRaw) || !eventTime) {
    return {
      error: {
        kind: CollectionErrorKind.MALFORMED_ROW,
        message: `Skipped unmappable row in ${table} (record ${sourceRecordId ?? '(no id)'})`,
        context: { table, recordId: sourceRecordId, station: stationRaw },
      },
    };
  }

  return {
    observation: {
      sourceRecordId,
      station: stationRaw as Station,
      batchId,
      workOrderId: asString(row[map.workOrderId]),
      lineId: asString(row[map.lineId]),
      quantity: asIntOrNull(row[map.quantity]),
      eventType: asString(row[map.eventType]),
      eventTime,
      rawPayload: toJsonable(row),
    },
  };
}

function buildConnection(ctx: SourceContext): PgConnectionConfig {
  return {
    host: requireString(ctx.config, 'host'),
    port: optionalNumber(ctx.config, 'port') ?? 5432,
    database: requireString(ctx.config, 'database'),
    user: requireString(ctx.config, 'user'),
    password: ctx.secret ?? '',
    ssl: ctx.config.ssl === true,
  };
}

function readColumnMap(selection: Record<string, unknown> | null | undefined): Partial<ColumnMap> {
  const raw = selection?.columnMap;
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<ColumnMap> = {};
  for (const key of Object.keys(DEFAULT_COLUMN_MAP) as Array<keyof ColumnMap>) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length > 0) out[key] = value;
  }
  return out;
}

async function safeEnd(client: PgLikeClient): Promise<void> {
  try {
    await client.end();
  } catch {
  }
}

function toJsonable(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return null;
}

function asIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
