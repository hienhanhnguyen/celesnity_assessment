export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends HttpError {
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, undefined, url);
    this.name = 'TimeoutError';
  }
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface HttpGetOptions {
  timeoutMs?: number;
  retry?: Partial<RetryOptions>;
  headers?: Record<string, string>;
}

export interface HttpDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface HttpResult<T> {
  data: T;
  status: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY: RetryOptions = { retries: 2, baseDelayMs: 200, maxDelayMs: 2000 };

const isRetriableStatus = (status: number): boolean => status >= 500 || status === 429;

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  options: HttpGetOptions,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { headers: options.headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGet(
  url: string,
  options: HttpGetOptions = {},
  deps: HttpDeps = {},
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry: RetryOptions = { ...DEFAULT_RETRY, ...options.retry };

  const backoff = async (attempt: number): Promise<void> => {
    const capped = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** attempt);
    const delay = capped / 2 + random() * (capped / 2);
    await sleep(delay);
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= retry.retries; attempt++) {
    try {
      const res = await fetchWithTimeout(fetchImpl, url, options, timeoutMs);
      if (res.ok) {
        return res;
      }
      if (isRetriableStatus(res.status) && attempt < retry.retries) {
        lastError = new HttpError(`HTTP ${res.status}`, res.status, url);
        await backoff(attempt);
        continue;
      }
      throw new HttpError(`HTTP ${res.status}`, res.status, url); // 4xx, or exhausted 5xx/429
    } catch (err) {
      if (err instanceof HttpError && err.status !== undefined && !isRetriableStatus(err.status)) {
        throw err;
      }
      lastError = err;
      if (attempt < retry.retries) {
        await backoff(attempt);
        continue;
      }
      if (err instanceof HttpError) throw err;
      throw new HttpError(err instanceof Error ? err.message : String(err), undefined, url);
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError('Request failed', undefined, url);
}

export async function httpGetJson<T = unknown>(
  url: string,
  options: HttpGetOptions = {},
  deps: HttpDeps = {},
): Promise<HttpResult<T>> {
  const res = await httpGet(url, options, deps);
  return { data: (await res.json()) as T, status: res.status };
}

export async function httpGetText(
  url: string,
  options: HttpGetOptions = {},
  deps: HttpDeps = {},
): Promise<HttpResult<string>> {
  const res = await httpGet(url, options, deps);
  return { data: await res.text(), status: res.status };
}
