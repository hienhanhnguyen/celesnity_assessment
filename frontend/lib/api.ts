import { apiUrl, type QueryValue } from './api-url.ts';
import type {
  BatchDetail,
  BatchFilter,
  BatchSummary,
  ConfigView,
  DiscoverResult,
  LineView,
  NormalizedRecordView,
  ObservationsFilter,
  RegisterSourceBody,
  RunView,
  SourceView,
  TestResult,
} from './types.ts';

const DEFAULT_BASE = 'http://localhost:3001';

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return null;
}

async function request<T>(
  method: string,
  path: string,
  params?: Record<string, QueryValue>,
  body?: unknown,
): Promise<T> {
  const hasBody = body !== undefined;
  const response = await fetch(apiUrl(API_BASE, `/api${path}`, params), {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(data) ?? `${response.status} ${response.statusText}`,
      data,
    );
  }
  return data as T;
}

const seg = (value: string): string => encodeURIComponent(value);

export const api = {
  listSources: (): Promise<SourceView[]> => request('GET', '/sources'),

  getSource: (id: string): Promise<SourceView> => request('GET', `/sources/${seg(id)}`),

  registerSource: (body: RegisterSourceBody): Promise<SourceView> =>
    request('POST', '/sources', undefined, body),

  testSource: (id: string): Promise<TestResult> => request('POST', `/sources/${seg(id)}/test`),

  discoverSource: (id: string): Promise<DiscoverResult> => request('GET', `/sources/${seg(id)}/discover`),

  updateSelection: (id: string, selection: Record<string, unknown>): Promise<SourceView> =>
    request('PATCH', `/sources/${seg(id)}/selection`, undefined, { selection }),

  collectSource: (id: string): Promise<RunView> => request('POST', `/sources/${seg(id)}/collect`),

  listRuns: (sourceId?: string): Promise<RunView[]> =>
    request('GET', '/collection-runs', sourceId ? { sourceId } : undefined),

  listObservations: (filter: ObservationsFilter = {}): Promise<NormalizedRecordView[]> =>
    request('GET', '/observations', filter as Record<string, QueryValue>),

  getConfig: (): Promise<ConfigView> => request('GET', '/config'),

  listLines: (): Promise<LineView[]> => request('GET', '/lines'),

  getLine: (id: string): Promise<LineView> => request('GET', `/lines/${seg(id)}`),

  listBatches: (filter: BatchFilter = {}): Promise<BatchSummary[]> =>
    request('GET', '/batches', filter as Record<string, QueryValue>),

  getBatch: (id: string): Promise<BatchDetail> => request('GET', `/batches/${seg(id)}`),

  acknowledgeBatch: (id: string, note?: string): Promise<BatchDetail> =>
    request('POST', `/batches/${seg(id)}/acknowledge`, undefined, note ? { note } : {}),

  blockBatch: (id: string, note?: string): Promise<BatchDetail> =>
    request('POST', `/batches/${seg(id)}/block`, undefined, note ? { note } : {}),

  resumeBatch: (id: string, note?: string): Promise<BatchDetail> =>
    request('POST', `/batches/${seg(id)}/resume`, undefined, note ? { note } : {}),

  noteBatch: (id: string, note: string): Promise<BatchDetail> =>
    request('POST', `/batches/${seg(id)}/note`, undefined, { note }),
};
