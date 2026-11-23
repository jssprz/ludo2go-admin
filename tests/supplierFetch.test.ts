// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchSupplierResource } from '../lib/supplier-fetch.mjs';

const mocks = vi.hoisted(() => ({ proxyAgent: vi.fn() }));
vi.mock('undici', () => ({
  EnvHttpProxyAgent: class {
    constructor() { mocks.proxyAgent(); }
  }
}));

const url = 'https://devir.cl/clank-catacumbas';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('preserves headers and timeout without changing global fetch configuration', async () => {
  const response = new Response('product page');
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchSupplierResource(url, { Accept: 'text/html' })).toBe(response);
  expect(fetchMock).toHaveBeenCalledWith(url, {
    headers: { Accept: 'text/html' },
    signal: expect.any(AbortSignal),
    cache: 'no-store',
  });
  expect(mocks.proxyAgent).not.toHaveBeenCalled();
});

test('uses the environment proxy dispatcher when configured', async () => {
  vi.stubEnv('HTTPS_PROXY', 'http://proxy.example:8080');
  const fetchMock = vi.fn().mockResolvedValue(new Response('product page'));
  vi.stubGlobal('fetch', fetchMock);
  await fetchSupplierResource(url);
  expect(mocks.proxyAgent).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined();
});

test('retries transient connection failures', async () => {
  const response = new Response('product page');
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new TypeError('fetch failed', {
      cause: Object.assign(new Error('timeout'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
    }))
    .mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  const pending = fetchSupplierResource(url);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('reports the URL and underlying connection code after three attempts', async () => {
  const cause = new TypeError('fetch failed', {
    cause: Object.assign(new Error('timeout'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
  });
  const fetchMock = vi.fn().mockRejectedValue(cause);
  vi.stubGlobal('fetch', fetchMock);
  const assertion = expect(fetchSupplierResource(url)).rejects.toThrow(
    'Could not fetch https://devir.cl/clank-catacumbas (UND_ERR_CONNECT_TIMEOUT)',
  );
  await vi.runAllTimersAsync();
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('does not retry or hide TLS errors or leak proxy credentials in the message', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed', {
    cause: Object.assign(new Error('https://user:secret@proxy.example'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchSupplierResource(url)).rejects.toThrow('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
  await expect(fetchSupplierResource(url)).rejects.not.toThrow('secret');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('returns access denials without retrying', async () => {
  const response = new Response('Forbidden', { status: 403 });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchSupplierResource(url)).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('releases retryable HTTP responses before retrying', async () => {
  const retryResponse = new Response('Unavailable', { status: 503 });
  const cancel = vi.spyOn(retryResponse.body!, 'cancel');
  const response = new Response('product page');
  const fetchMock = vi.fn().mockResolvedValueOnce(retryResponse).mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  const pending = fetchSupplierResource(url);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(response);
  expect(cancel).toHaveBeenCalledOnce();
});
