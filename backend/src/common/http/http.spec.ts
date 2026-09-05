import { httpGetJson, httpGetText, HttpError, TimeoutError, type HttpDeps } from './http';

const noopSleep = () => Promise.resolve();
const fixedRandom = () => 0.5;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function textResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

const deps = (fetchImpl: jest.Mock): HttpDeps => ({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noopSleep, random: fixedRandom });

describe('httpGetJson', () => {
  it('returns parsed JSON on success', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { hello: 'world' }));
    const res = await httpGetJson<{ hello: string }>('http://x/api', {}, deps(fetchImpl));
    expect(res.data).toEqual({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 then succeeds', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const res = await httpGetJson('http://x/api', { retry: { retries: 2 } }, deps(fetchImpl));
    expect(res.data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries on persistent 5xx', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(503, {}));
    await expect(
      httpGetJson('http://x/api', { retry: { retries: 2 } }, deps(fetchImpl)),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry a 4xx', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(400, {}));
    await expect(httpGetJson('http://x/api', { retry: { retries: 3 } }, deps(fetchImpl))).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a network error then succeeds', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse(200, { recovered: true }));
    const res = await httpGetJson('http://x/api', { retry: { retries: 1 } }, deps(fetchImpl));
    expect(res.data).toEqual({ recovered: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns the raw text body and retries a 503 first (crawler path)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(textResponse(503, ''))
      .mockResolvedValueOnce(textResponse(200, '<html><body>ok</body></html>'));
    const res = await httpGetText('http://x/page', { retry: { retries: 2 } }, deps(fetchImpl));
    expect(res.data).toContain('<body>ok</body>');
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws TimeoutError when a request exceeds the timeout', async () => {
    const fetchImpl = jest.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    await expect(
      httpGetJson('http://x/api', { timeoutMs: 20, retry: { retries: 0 } }, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        random: fixedRandom,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
