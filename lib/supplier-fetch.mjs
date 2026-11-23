import { EnvHttpProxyAgent } from 'undici';

const FETCH_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
]);

let proxyAgent;

function getProxyAgent() {
  if (!['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].some((key) => process.env[key])) {
    return undefined;
  }
  proxyAgent ??= new EnvHttpProxyAgent();
  return proxyAgent;
}

function errorCodes(error) {
  if (!error || typeof error !== 'object') return [];
  const codes = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? [error.code]
    : [];
  if (error.name === 'TimeoutError') codes.push('ETIMEDOUT');
  if (error.cause) codes.push(...errorCodes(error.cause));
  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) codes.push(...errorCodes(nested));
  }
  return [...new Set(codes)];
}

/**
 * Fetch a public supplier resource using the environment's proxy configuration.
 * @param {string} resourceUrl
 * @param {Record<string, string>} headers
 * @returns {Promise<Response>}
 */
export async function fetchSupplierResource(resourceUrl, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      const dispatcher = getProxyAgent();
      response = await fetch(resourceUrl, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
        ...(dispatcher ? { dispatcher } : {}),
      });
    } catch (error) {
      const codes = errorCodes(error);
      if (attempt === 2 || !codes.some((code) => RETRYABLE_CODES.has(code))) {
        const url = new URL(resourceUrl);
        const detail = codes.length ? ` (${codes.join(', ')})` : '';
        throw new Error(
          `Could not fetch ${url.origin}${url.pathname}${detail}. Check network access, DNS, TLS certificates and HTTP_PROXY/HTTPS_PROXY settings.`,
          { cause: error },
        );
      }
    }

    if (response) {
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === 2) return response;
      await response.body?.cancel();
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error('Supplier request exhausted all attempts');
}
