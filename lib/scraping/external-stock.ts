import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch as pinnedFetch } from 'undici';
import type { Availability } from './supplier-catalog';

type ExpectedProduct = { sku: string; barcode: string | null };

export function extractExternalAvailability(
  html: string,
  expected?: ExpectedProduct
): Availability {
  const page = inspectExternalPage(html, expected);
  return page.identityVerified ? page.availability : 'unknown';
}

export function inspectExternalPage(
  html: string,
  expected?: ExpectedProduct
): { identityVerified: boolean; availability: Availability } {
  const $ = cheerio.load(html);
  const evidence: Availability[] = [];
  const availability = (value: unknown) => {
    if (typeof value !== 'string') return;
    if (/^(?:https?:\/\/schema\.org\/)?OutOfStock\/?$/i.test(value))
      evidence.push('out_of_stock');
    else if (/^(?:https?:\/\/schema\.org\/)?InStock\/?$/i.test(value))
      evidence.push('in_stock');
  };
  const products: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type'])
      ? object['@type']
      : [object['@type']];
    if (types.includes('Product')) products.push(object);
    if (object['@graph']) visit(object['@graph']);
  };
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      visit(JSON.parse($(node).text()));
    } catch {}
  });
  if (expected) {
    const product = products.length === 1 ? products[0] : null;
    const barcodes = product
      ? [
          product.gtin,
          product.gtin8,
          product.gtin12,
          product.gtin13,
          product.gtin14
        ]
          .filter((value) => value != null)
          .map(String)
      : [];
    const sku =
      product?.sku != null
        ? String(product.sku)
        : $('.summary .sku, .product__info-container [itemprop="sku"]')
            .first()
            .text()
            .trim();
    if (
      expected.barcode && barcodes.length
        ? !barcodes.includes(expected.barcode)
        : !sku || sku !== expected.sku
    )
      return { identityVerified: false, availability: 'unknown' };
  }
  if (products.length === 1) {
    const offers = products[0].offers;
    const list = Array.isArray(offers) ? offers : [offers];
    for (const offer of list) {
      if (offer && typeof offer === 'object')
        availability((offer as Record<string, unknown>).availability);
    }
  }
  $(
    '.summary [itemprop="availability"], main > [itemprop="availability"]'
  ).each((_, node) =>
    availability($(node).attr('href') || $(node).attr('content'))
  );
  $(
    '.summary .stock, .product__info-container .stock, .product-single__meta .stock'
  ).each((_, node) => {
    const stock = $(node);
    if (stock.hasClass('out-of-stock')) evidence.push('out_of_stock');
    if (stock.hasClass('in-stock')) evidence.push('in_stock');
  });
  const unique = Array.from(new Set(evidence));
  return {
    identityVerified: true,
    availability: unique.length === 1 ? unique[0] : 'unknown'
  };
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3]
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['::ffff:0:0', 96]
] as const)
  blocked.addSubnet(address, prefix, 'ipv6');

async function publicUrl(url: URL) {
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new Error('invalid_store_url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address, family }) =>
      blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')
    )
  )
    throw new Error('private_store_url');
  return addresses;
}

export async function fetchPublicHtml(
  url: string,
  trace?: string[]
): Promise<string | null> {
  const note = (reason: string | number) => trace?.push(`${reason} ${url}`);
  try {
    let current = new URL(url);
    const origin = current.origin;
    for (let redirects = 0; redirects < 4; redirects++) {
      const addresses = await publicUrl(current);
      const dispatcher = new Agent({
        connect: {
          autoSelectFamily: false,
          lookup: (_hostname, _options, callback) => {
            callback(null, addresses[0].address, addresses[0].family);
          }
        }
      });
      try {
        const response = await pinnedFetch(current, {
          dispatcher,
          redirect: 'manual',
          signal: AbortSignal.timeout(12000),
          headers: {
            'User-Agent': 'Jobys-Stock-Check/1.0',
            Accept: 'text/html'
          }
        });
        if (response.status >= 400) note(response.status);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) return null;
          current = new URL(location, current);
          if (current.origin !== origin) return null;
          continue;
        }
        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('text/html')
        ) {
          await response.body?.cancel();
          if (response.status < 400) note('not_html');
          return null;
        }
        const reader = response.body?.getReader();
        if (!reader) return null;
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 3_000_000) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        return Buffer.concat(chunks).toString('utf8');
      } finally {
        await dispatcher.close();
      }
    }
  } catch {
    note('unreachable');
  }
  return null;
}

export async function checkExternalStock(
  url: string,
  expected?: ExpectedProduct
): Promise<Availability> {
  const html = await fetchPublicHtml(url);
  return html === null ? 'unknown' : extractExternalAvailability(html, expected);
}
