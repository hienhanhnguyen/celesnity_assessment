import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import { httpGetJson, HttpError, type HttpResult } from '../common/http/http';
import { ApiCollector, type HttpJsonClient } from './api.collector';
import type { PageEnvelope } from './pagination';
import type { SourceContext } from './collector.types';

type Row = Record<string, unknown>;

const ISO = (min: number) => new Date(Date.UTC(2026, 8, 1, 10, 0, 0) - min * 60_000).toISOString();

const DB: Record<string, Row[]> = {
  '/api/work-orders': [
    { workOrderId: 'WO-1001', lineId: 'LINE-A', status: 'IN_PROGRESS', customer: 'Grand Hotel' },
    { workOrderId: 'WO-1002', lineId: 'LINE-A', status: 'IN_PROGRESS', customer: 'City Clinic' },
    { workOrderId: 'WO-1003', lineId: 'LINE-B', status: 'IN_PROGRESS', customer: 'Seaside Resort' },
    { workOrderId: 'WO-1004', lineId: 'LINE-B', status: 'IN_PROGRESS', customer: 'Riverside Spa' },
    { workOrderId: 'WO-1005', lineId: 'LINE-A', status: 'PLANNED', customer: 'Grand Hotel' },
  ],
  '/api/batches': [
    { batchId: 'BATCH-0001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
    { batchId: 'BATCH-0002', workOrderId: 'WO-1001', lineId: 'LINE-A' },
    { batchId: 'BATCH-0003', workOrderId: 'WO-1002', lineId: 'LINE-A' },
    { batchId: 'BATCH-0004', workOrderId: 'WO-1002', lineId: 'LINE-A' },
    { batchId: 'BATCH-0005', workOrderId: 'WO-1003', lineId: 'LINE-B' },
    { batchId: 'BATCH-0006', workOrderId: 'WO-1003', lineId: 'LINE-B' },
    { batchId: 'BATCH-0007', workOrderId: 'WO-1004', lineId: 'LINE-B' },
    { batchId: 'BATCH-0008', workOrderId: 'WO-1005', lineId: 'LINE-A' },
  ],
  '/api/receiving': [
    {
      recordId: 'RCV-0001',
      batchId: 'BATCH-0001',
      lineId: 'LINE-A',
      station: 'RECEIVING',
      eventType: 'RECEIVING_LOGGED',
      quantity: 100,
      eventTime: ISO(90),
    },
    {
      recordId: 'RCV-0002',
      batchId: 'BATCH-0002',
      lineId: 'LINE-A',
      station: 'RECEIVING',
      eventType: 'RECEIVING_LOGGED',
      quantity: 60,
      eventTime: ISO(80),
    },
  ],
  '/api/dispatch': [
    {
      recordId: 'DSP-0001',
      batchId: 'BATCH-0001',
      lineId: 'LINE-A',
      station: 'DISPATCH',
      eventType: 'DISPATCH_ACCEPTED',
      quantity: 100,
      eventTime: ISO(6),
      destination: 'Grand Hotel',
    },
  ],
};

function pageOf(arr: Row[], page: number, size: number): PageEnvelope<Row> {
  const start = (page - 1) * size;
  return {
    data: arr.slice(start, start + size),
    page,
    pageSize: size,
    total: arr.length,
    totalPages: Math.max(1, Math.ceil(arr.length / size)),
  };
}

function cannedHttp(db: Record<string, Row[]>): HttpJsonClient {
  return {
    async getJson<T>(url: string): Promise<HttpResult<T>> {
      const u = new URL(url);
      const arr = db[u.pathname];
      if (!arr) throw new HttpError('HTTP 404', 404, url);
      const page = Number(u.searchParams.get('page') ?? '1');
      const size = Number(u.searchParams.get('pageSize') ?? '100');
      return { data: pageOf(arr, page, size) as unknown as T, status: 200 };
    },
  };
}

const ctx = (selection?: Record<string, unknown>): SourceContext => ({
  config: { baseUrl: 'http://fixtures.test:4000', pageSize: 3 },
  selection: selection ?? null,
});

describe('ApiCollector', () => {
  it('is the API source type', () => {
    expect(new ApiCollector().type).toBe(SourceType.API);
  });

  it('walks every page and ingests reference data + observations', async () => {
    const collector = new ApiCollector(cannedHttp(DB));
    const result = await collector.collect(ctx());

    // 5 work orders (2 pages - size 3) + 8 batches (3 pages) as reference
    expect(result.references?.workOrders).toHaveLength(5);
    expect(result.references?.batches).toHaveLength(8);

    // 2 receiving + 1 dispatch as observations.
    expect(result.observations).toHaveLength(3);
    expect(result.observations.filter((o) => o.station === Station.RECEIVING)).toHaveLength(2);
    expect(result.observations.filter((o) => o.station === Station.DISPATCH)).toHaveLength(1);

    // pages walk: work orders 2 + batches 3 + receiving 1 + dispatch 1
    expect(result.stats.pagesFetched).toBe(7);
    expect(result.stats.malformed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('enriches an observation with the workOrderId from the same source mapping', async () => {
    const collector = new ApiCollector(cannedHttp(DB));
    const result = await collector.collect(ctx());

    const dispatch = result.observations.find((o) => o.station === Station.DISPATCH);
    expect(dispatch?.batchId).toBe('BATCH-0001');
    expect(dispatch?.workOrderId).toBe('WO-1001');
    expect(dispatch?.quantity).toBe(100);
    expect(dispatch?.eventTime).toBeInstanceOf(Date);
  });

  it('honours an endpoint selection', async () => {
    const collector = new ApiCollector(cannedHttp(DB));
    const result = await collector.collect(ctx({ endpoints: ['receiving'] }));

    expect(result.observations).toHaveLength(2);
    expect(result.references?.workOrders).toHaveLength(0);
    expect(result.references?.batches).toHaveLength(0);
  });

  it('records a malformed record as an error and keeps collecting', async () => {
    const badDb: Record<string, Row[]> = {
      ...DB,
      '/api/receiving': [
        ...DB['/api/receiving'],
        { recordId: 'RCV-BAD', lineId: 'LINE-A', station: 'RECEIVING', quantity: 10 }, // no batchId
      ],
    };
    const collector = new ApiCollector(cannedHttp(badDb));
    const result = await collector.collect(ctx());

    expect(result.observations.filter((o) => o.station === Station.RECEIVING)).toHaveLength(2);
    expect(result.stats.malformed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].kind).toBe(CollectionErrorKind.MALFORMED_ROW);
  });

  it('retries the source\'s deterministic first-attempt 503 on dispatch and still collects', async () => {
    let dispatchAttempts = 0;
    const fakeFetch = (async (url: string) => {
      const u = new URL(url);
      const page = Number(u.searchParams.get('page') ?? '1');
      const size = Number(u.searchParams.get('pageSize') ?? '100');
      if (u.pathname === '/api/dispatch' && page === 1 && dispatchAttempts++ === 0) {
        return { ok: false, status: 503, json: async () => ({ error: 'transient' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => pageOf(DB[u.pathname] ?? [], page, size) } as unknown as Response;
    }) as unknown as typeof fetch;

    const http: HttpJsonClient = {
      getJson: (url, options) =>
        httpGetJson(url, options, { fetchImpl: fakeFetch, sleep: () => Promise.resolve(), random: () => 0.5 }),
    };
    const collector = new ApiCollector(http);
    const result = await collector.collect(ctx({ endpoints: ['dispatch'] }));

    expect(dispatchAttempts).toBe(2); // first 503, then success
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].batchId).toBe('BATCH-0001');
  });
});
