import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station, isStation } from '../common/domain/station';
import { httpGetJson, type HttpGetOptions, type HttpResult } from '../common/http/http';
import { fetchAllPages, type PageEnvelope, type PagedWalk } from './pagination';
import { describeError, optionalNumber, optionalStringList, requireString } from './util';
import type {
  CollectResult,
  CollectorError,
  DiscoverResult,
  RawBatchMapping,
  RawObservation,
  RawWorkOrder,
  SourceCollector,
  SourceContext,
  TestResult,
} from './collector.types';

export interface HttpJsonClient {
  getJson<T>(url: string, options?: HttpGetOptions): Promise<HttpResult<T>>;
}

const defaultJsonClient: HttpJsonClient = {
  getJson: (url, options) => httpGetJson(url, options),
};

const ALL_ENDPOINTS = ['work-orders', 'batches', 'receiving', 'dispatch'] as const;
const DEFAULT_PAGE_SIZE = 100;

type BatchRef = { workOrderId: string | null; lineId: string | null };

export class ApiCollector implements SourceCollector {
  readonly type = SourceType.API;

  constructor(private readonly http: HttpJsonClient = defaultJsonClient) {}

  async test(ctx: SourceContext): Promise<TestResult> {
    const base = requireString(ctx.config, 'baseUrl');
    try {
      const { data } = await this.http.getJson<{ status?: string; service?: string }>(
        new URL('/api/health', base).toString(),
        { retry: { retries: 1 } },
      );
      const ok = data?.status === 'ok';
      return {
        ok,
        message: ok ? 'Application API reachable' : 'Unexpected health response',
        detail: { service: data?.service ?? null },
      };
    } catch (err) {
      return { ok: false, message: describeError(err) };
    }
  }

  async discover(_ctx: SourceContext): Promise<DiscoverResult> {
    return {
      entities: [
        { name: 'work-orders', kind: 'endpoint', produces: 'reference' },
        { name: 'batches', kind: 'endpoint', produces: 'reference' },
        { name: 'receiving', kind: 'endpoint', produces: 'observations' },
        { name: 'dispatch', kind: 'endpoint', produces: 'observations' },
      ],
    };
  }

  async collect(ctx: SourceContext): Promise<CollectResult> {
    const base = requireString(ctx.config, 'baseUrl');
    const pageSize = optionalNumber(ctx.config, 'pageSize') ?? DEFAULT_PAGE_SIZE;
    const wanted = new Set(optionalStringList(ctx.selection, 'endpoints') ?? ALL_ENDPOINTS);

    const errors: CollectorError[] = [];
    const workOrders: RawWorkOrder[] = [];
    const batches: RawBatchMapping[] = [];
    const observations: RawObservation[] = [];
    const batchIndex = new Map<string, BatchRef>();
    let pagesFetched = 0;
    let malformed = 0;

    if (wanted.has('work-orders')) {
      const walk = await this.walk<ApiWorkOrderRow>(base, '/api/work-orders', pageSize);
      pagesFetched += walk.pages;
      for (const row of walk.rows) {
        const workOrderId = asString(row.workOrderId);
        if (!workOrderId) {
          malformed += 1;
          errors.push(malformedRow('work-orders', row, 'missing workOrderId'));
          continue;
        }
        workOrders.push({
          workOrderId,
          lineId: asString(row.lineId),
          status: asString(row.status),
          metadata: { customer: asString(row.customer) },
        });
      }
    }

    if (wanted.has('batches')) {
      const walk = await this.walk<ApiBatchRow>(base, '/api/batches', pageSize);
      pagesFetched += walk.pages;
      for (const row of walk.rows) {
        const batchId = asString(row.batchId);
        if (!batchId) {
          malformed += 1;
          errors.push(malformedRow('batches', row, 'missing batchId'));
          continue;
        }
        const ref: BatchRef = { workOrderId: asString(row.workOrderId), lineId: asString(row.lineId) };
        batchIndex.set(batchId, ref);
        batches.push({ batchId, workOrderId: ref.workOrderId, lineId: ref.lineId, metadata: {} });
      }
    }

    if (wanted.has('receiving')) {
      pagesFetched += await this.collectEvents(
        base,
        '/api/receiving',
        pageSize,
        Station.RECEIVING,
        batchIndex,
        observations,
        errors,
        () => (malformed += 1),
      );
    }

    if (wanted.has('dispatch')) {
      pagesFetched += await this.collectEvents(
        base,
        '/api/dispatch',
        pageSize,
        Station.DISPATCH,
        batchIndex,
        observations,
        errors,
        () => (malformed += 1),
      );
    }

    const fetched = workOrders.length + batches.length + observations.length + malformed;
    return {
      observations,
      references: { workOrders, batches },
      errors,
      stats: { fetched, pagesFetched, malformed },
    };
  }

  private async collectEvents(
    base: string,
    path: string,
    pageSize: number,
    expected: Station,
    batchIndex: Map<string, BatchRef>,
    observations: RawObservation[],
    errors: CollectorError[],
    onMalformed: () => void,
  ): Promise<number> {
    const walk = await this.walk<ApiEventRow>(base, path, pageSize);
    for (const row of walk.rows) {
      const obs = toObservation(row, expected, batchIndex, errors, path);
      if (obs) observations.push(obs);
      else onMalformed();
    }
    return walk.pages;
  }

  private async walk<T>(base: string, path: string, pageSize: number): Promise<PagedWalk<T>> {
    return fetchAllPages<T>(async (page) => {
      const url = new URL(path, base);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      const { data } = await this.http.getJson<PageEnvelope<T>>(url.toString());
      return data;
    });
  }
}

// Raw row shapes (fields treated as unknown, the source may be imperfect)

interface ApiWorkOrderRow {
  workOrderId?: unknown;
  lineId?: unknown;
  status?: unknown;
  customer?: unknown;
}
interface ApiBatchRow {
  batchId?: unknown;
  workOrderId?: unknown;
  lineId?: unknown;
}
interface ApiEventRow {
  recordId?: unknown;
  batchId?: unknown;
  lineId?: unknown;
  station?: unknown;
  eventType?: unknown;
  quantity?: unknown;
  eventTime?: unknown;
  [key: string]: unknown;
}

function toObservation(
  row: ApiEventRow,
  expected: Station,
  batchIndex: Map<string, BatchRef>,
  errors: CollectorError[],
  path: string,
): RawObservation | null {
  const sourceRecordId = asString(row.recordId);
  const batchId = asString(row.batchId);
  const rawStation = asString(row.station);
  const station = rawStation && isStation(rawStation) ? rawStation : expected;
  const eventTime = parseDate(row.eventTime);

  if (!sourceRecordId || !batchId || !eventTime) {
    errors.push(
      malformedRow(path, row, 'missing recordId/batchId or unparseable eventTime'),
    );
    return null;
  }

  const ref = batchIndex.get(batchId);
  return {
    sourceRecordId,
    station,
    batchId,
    workOrderId: ref?.workOrderId ?? null,
    lineId: asString(row.lineId) ?? ref?.lineId ?? null,
    quantity: asIntOrNull(row.quantity),
    eventType: asString(row.eventType),
    eventTime,
    rawPayload: { ...row },
  };
}

function malformedRow(endpoint: string, row: unknown, reason: string): CollectorError {
  const recordId =
    row && typeof row === 'object' && 'recordId' in row ? String((row as ApiEventRow).recordId) : null;
  return {
    kind: CollectionErrorKind.MALFORMED_ROW,
    message: `Skipped malformed ${endpoint} record: ${reason}`,
    context: { endpoint, recordId },
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
