import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { CollectionErrorKind, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import { httpGetText, type HttpGetOptions, type HttpResult } from '../common/http/http';
import {
  describeError,
  normalizeUrl,
  optionalNumber,
  optionalString,
  requireString,
  resolveUrl,
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

// HTTP surface the collector need
export interface HttpTextClient {
  getText(url: string, options?: HttpGetOptions): Promise<HttpResult<string>>;
}

const defaultTextClient: HttpTextClient = {
  getText: (url, options) => httpGetText(url, options),
};

const START_PATH = '/suppliers/deliveries';
const DEFAULT_MAX_PAGES = 50;

export class CrawlerCollector implements SourceCollector {
  readonly type = SourceType.CRAWLER;

  constructor(private readonly http: HttpTextClient = defaultTextClient) {}

  async test(ctx: SourceContext): Promise<TestResult> {
    const base = requireString(ctx.config, 'baseUrl');
    const startPath = optionalString(ctx.config, 'startPath') ?? START_PATH;
    try {
      const { data } = await this.http.getText(firstPageUrl(base, startPath), {
        retry: { retries: 1 },
      });
      const $ = cheerio.load(data);
      const rows = $('table#deliveries tr.delivery').length;
      return {
        ok: rows > 0,
        message: rows > 0 ? 'Crawler listing reachable' : 'No delivery rows found on first page',
        detail: { rows },
      };
    } catch (err) {
      return { ok: false, message: describeError(err) };
    }
  }

  async discover(ctx: SourceContext): Promise<DiscoverResult> {
    const base = requireString(ctx.config, 'baseUrl');
    const startPath = optionalString(ctx.config, 'startPath') ?? START_PATH;
    const { data } = await this.http.getText(firstPageUrl(base, startPath));
    const $ = cheerio.load(data);
    const fields = $('table#deliveries thead th')
      .map((_i, el) => $(el).text().trim())
      .get();
    return {
      entities: [{ name: 'deliveries', kind: 'endpoint', produces: 'observations', fields }],
    };
  }

  async collect(ctx: SourceContext): Promise<CollectResult> {
    const base = requireString(ctx.config, 'baseUrl');
    const startPath = optionalString(ctx.config, 'startPath') ?? START_PATH;
    const maxPages =
      optionalNumber(ctx.selection, 'maxPages') ??
      optionalNumber(ctx.config, 'maxPages') ??
      DEFAULT_MAX_PAGES;

    const observations: RawObservation[] = [];
    const errors: CollectorError[] = [];
    let malformed = 0;
    let pagesFetched = 0;

    // 3 part loop guard 
    const visitedUrls = new Set<string>();
    const contentHashes = new Set<string>();

    let nextUrl: string | null = firstPageUrl(base, startPath);

    while (nextUrl) {
      const urlKey = normalizeUrl(nextUrl);
      if (visitedUrls.has(urlKey)) break; // (1) cycle: URL already fetched
      if (visitedUrls.size >= maxPages) {
        // (2) cap: something is keep paging, stop and flag it, no fail
        errors.push({
          kind: CollectionErrorKind.VALIDATION,
          message: `Stopped after ${maxPages} pages (possible pagination loop)`,
          context: { lastUrl: urlKey },
        });
        break;
      }
      visitedUrls.add(urlKey);

      const { data: html } = await this.http.getText(nextUrl);
      pagesFetched += 1;

      const hash = createHash('sha1').update(html).digest('hex');
      if (contentHashes.has(hash)) break; // (3) same content under a new URL
      contentHashes.add(hash);

      const $ = cheerio.load(html);
      $('tr.delivery').each((_i, el) => {
        const result = parseRow($(el), urlKey);
        if (result.observation) observations.push(result.observation);
        if (result.error) {
          malformed += 1;
          errors.push(result.error);
        }
      });

      const href = $('a.next[rel="next"]').attr('href') ?? $('a.next').attr('href') ?? null;
      nextUrl = href ? resolveUrl(base, href) : null;
    }

    return {
      observations,
      errors,
      stats: { fetched: observations.length + malformed, pagesFetched, malformed },
    };
  }
}

type RowResult = { observation?: RawObservation; error?: CollectorError };

type DeliveryRow = cheerio.Cheerio<any>;

function parseRow(row: DeliveryRow, pageKey: string): RowResult {
  const recordId = (row.attr('data-record-id') ?? '').trim();
  const batchId = row.find('.batch-id').text().trim();
  const lineId = row.find('.line-id').text().trim();
  const quantityText = row.find('.quantity').text().trim();
  const receivedAt = row.find('.received-at').text().trim();
  const supplier = row.find('.supplier').text().trim();

  const quantity = Number.parseInt(quantityText, 10);
  const eventTime = new Date(receivedAt);
  const flaggedMalformed = row.hasClass('malformed');

  if (flaggedMalformed || !batchId || !Number.isFinite(quantity) || Number.isNaN(eventTime.getTime())) {
    return {
      error: {
        kind: CollectionErrorKind.MALFORMED_ROW,
        message: `Skipped malformed delivery row ${recordId || '(no id)'}`,
        context: {
          recordId: recordId || null,
          page: pageKey,
          batchId: batchId || null,
          quantity: quantityText || null,
        },
      },
    };
  }

  return {
    observation: {
      sourceRecordId: recordId,
      station: Station.RECEIVING,
      batchId,
      lineId: lineId || null,
      quantity,
      eventType: 'DELIVERY_RECEIVED',
      eventTime,
      rawPayload: { recordId, batchId, lineId, quantity: quantityText, receivedAt, supplier },
    },
  };
}

function firstPageUrl(base: string, startPath: string): string {
  const url = new URL(startPath, base);
  url.searchParams.set('page', '1');
  return url.toString();
}
