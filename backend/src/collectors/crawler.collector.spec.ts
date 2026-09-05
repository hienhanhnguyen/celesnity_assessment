import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { HttpResult } from '../common/http/http';
import { CrawlerCollector, type HttpTextClient } from './crawler.collector';
import type { SourceContext } from './collector.types';

const RECEIVED_AT = '2026-09-01T09:00:00.000Z';

function row(id: string, batch: string, qty: number, line = 'LINE-A'): string {
  return `<tr class="delivery" data-record-id="${id}">
    <td class="record-id">${id}</td>
    <td class="batch-id">${batch}</td>
    <td class="line-id">${line}</td>
    <td class="quantity">${qty}</td>
    <td class="received-at">${RECEIVED_AT}</td>
    <td class="supplier">LinenCo</td>
  </tr>`;
}

function malformedRow(id: string): string {
  return `<tr class="delivery malformed" data-record-id="${id}">
    <td class="record-id">${id}</td>
    <td class="batch-id"></td>
    <td class="line-id">LINE-A</td>
    <td class="quantity">N/A</td>
    <td class="received-at">${RECEIVED_AT}</td>
    <td class="supplier">TextileHub</td>
  </tr>`;
}

function wrapPage(rowsHtml: string, nextPage: number): string {
  return `<!doctype html><html><body>
    <table id="deliveries">
      <thead><tr><th>Record</th><th>Batch</th><th>Line</th><th>Quantity</th><th>Received</th><th>Supplier</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <nav class="pager"><a class="next" rel="next" href="/suppliers/deliveries?page=${nextPage}">Next</a></nav>
  </body></html>`;
}

// 3 pages, 7 good rows + 1 malformed, last page cycles to page 1
function fixturesPage(page: number): string {
  if (page === 1) {
    return wrapPage(row('DLV-0001', 'BATCH-0001', 100) + row('DLV-0002', 'BATCH-0002', 60) + row('DLV-0003', 'BATCH-0003', 80), 2);
  }
  if (page === 2) {
    return wrapPage(row('DLV-0004', 'BATCH-0004', 70) + malformedRow('DLV-0099') + row('DLV-0005', 'BATCH-0005', 50), 3);
  }
  return wrapPage(row('DLV-0006', 'BATCH-0006', 90) + row('DLV-0007', 'BATCH-0007', 40), 1); // cycle → page 1
}

function httpFrom(render: (page: number) => string, onFetch?: (page: number) => void): HttpTextClient {
  return {
    async getText(url: string): Promise<HttpResult<string>> {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      onFetch?.(page);
      return { data: render(page), status: 200 };
    },
  };
}

const ctx = (selection?: Record<string, unknown>): SourceContext => ({
  config: { baseUrl: 'http://fixtures.test:4000' },
  selection: selection ?? null,
});

describe('CrawlerCollector', () => {
  it('is the CRAWLER source type', () => {
    expect(new CrawlerCollector().type).toBe(SourceType.CRAWLER);
  });

  it('scrapes all good rows, skips the malformed one, and stops at the page cycle', async () => {
    let fetches = 0;
    const collector = new CrawlerCollector(httpFrom(fixturesPage, () => (fetches += 1)));
    const result = await collector.collect(ctx());

    // 7 good deliveries as RECEIVING observations
    expect(result.observations).toHaveLength(7);
    expect(result.observations.every((o) => o.station === Station.RECEIVING)).toBe(true);
    expect(result.observations[0].sourceRecordId).toBe('DLV-0001');
    expect(result.observations[0].eventType).toBe('DELIVERY_RECEIVED');
    expect(result.observations[0].eventTime).toBeInstanceOf(Date);

    // 1 malformed row: one non-fatal error, run keeps its observations
    expect(result.stats.malformed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].kind).toBe(CollectionErrorKind.MALFORMED_ROW);

    expect(result.stats.pagesFetched).toBe(3);
    expect(fetches).toBe(3);
  });

  it('loop guard: stops on repeated content served under a new URL (content hash)', async () => {
    let fetches = 0;
    const constantPage = () => wrapPage(row('DLV-0001', 'BATCH-0001', 100), 2);
    const collector = new CrawlerCollector(httpFrom(constantPage, () => (fetches += 1)));
    const result = await collector.collect(ctx());

    // Page 1 parsed, page 2 fetched, hash matches: break before double-counting
    expect(fetches).toBe(2);
    expect(result.observations).toHaveLength(1);
  });

  it('loop guard: stops at the max-page cap and flags it', async () => {
    let n = 0;
    const alwaysNew = (page: number) => wrapPage(row(`DLV-${page}`, `BATCH-${page}`, (n += 1)), page + 1);
    const collector = new CrawlerCollector(httpFrom(alwaysNew));
    const result = await collector.collect(ctx({ maxPages: 3 }));

    expect(result.stats.pagesFetched).toBe(3);
    expect(result.errors.some((e) => e.kind === CollectionErrorKind.VALIDATION)).toBe(true);
  });

  it('discover reports the delivery table columns', async () => {
    const collector = new CrawlerCollector(httpFrom(fixturesPage));
    const { entities } = await collector.discover(ctx());
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('deliveries');
    expect(entities[0].fields).toEqual(['Record', 'Batch', 'Line', 'Quantity', 'Received', 'Supplier']);
  });

  it('test() succeeds when the first page has delivery rows', async () => {
    const collector = new CrawlerCollector(httpFrom(fixturesPage));
    const result = await collector.test(ctx());
    expect(result.ok).toBe(true);
    expect(result.detail?.rows).toBe(3);
  });
});
