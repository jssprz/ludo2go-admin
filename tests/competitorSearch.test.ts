import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eanDigits,
  extractCandidates,
  isNewProductOpportunity,
  nameMatchThreshold,
  nameScore,
  pageTitles,
  searchQueries,
  searchUrls,
  slugGuesses
} from '../lib/scraping/competitor-search';
import { inspectExternalPage } from '../lib/scraping/external-stock';

test('builds search urls and normalizes EANs', () => {
  assert.deepEqual(searchUrls('https://shop.example/path', '123 45'), [
    'https://shop.example/search?q=123%2045',
    'https://shop.example/?s=123%2045&post_type=product'
  ]);
  assert.equal(eanDigits('8-710126-199022'), '8710126199022');
  assert.equal(eanDigits('123'), null);
});

test('extracts same-origin product candidates only', () => {
  const html = `<a href="/products/a?x=1" title="Game A">x</a>
    <a href="/products/a">dup</a>
    <a href="https://evil.example/products/b">B</a>
    <a href="/producto/c">Game C</a><a href="/about">About</a>`;
  assert.deepEqual(extractCandidates(html, 'https://shop.example'), [
    { url: 'https://shop.example/products/a', title: 'Game A' },
    { url: 'https://shop.example/producto/c', title: 'Game C' }
  ]);
});

test('page identity is separate from availability', () => {
  const page = (gtin: string) =>
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', gtin13: gtin, offers: { availability: 'OutOfStock' } })}</script>`;
  const expected = { sku: '', barcode: '8710126199022' };
  assert.deepEqual(inspectExternalPage(page('8710126199022'), expected), {
    identityVerified: true,
    availability: 'out_of_stock'
  });
  assert.equal(
    inspectExternalPage(page('9999999999999'), expected).identityVerified,
    false
  );
});

test('new-product opportunity needs a store and all out of stock', () => {
  assert.equal(isNewProductOpportunity([]), false);
  assert.equal(
    isNewProductOpportunity([{ availability: 'out_of_stock' }]),
    true
  );
  assert.equal(
    isNewProductOpportunity([
      { availability: 'out_of_stock' },
      { availability: 'unknown' }
    ]),
    false
  );
});

test('supplier names match competitor titles despite publisher prefix and expansion marker', () => {
  const supplier = 'JDM Carcassonne Torres y Ladrones (Exp4)';
  assert.ok(nameScore(supplier, 'Carcassonne: Torres y Ladrones') >= nameMatchThreshold);
  assert.ok(nameScore(supplier, 'carcassonne torres y ladrones') >= nameMatchThreshold);
  assert.deepEqual(slugGuesses(supplier), [
    'carcassonne-torres-y-ladrones',
    'carcassonne-torres-ladrones'
  ]);
  assert.equal(searchQueries(supplier)[0], 'carcassonne torres ladrones');
});

test('base games, expansions and numbered editions are not confused', () => {
  assert.ok(nameScore('Carcassonne', 'Carcassonne Torres y Ladrones') < nameMatchThreshold);
  assert.equal(nameScore('Catan 2', 'Catan'), 0);
  assert.ok(nameScore('Catan', 'Catan') >= nameMatchThreshold);
  assert.ok(nameScore('Wingspan', 'Carcassonne') < nameMatchThreshold);
});

test('reads product titles from JSON-LD, og:title and h1', () => {
  const html = `<title>Carcassonne Torres | Gato</title>
    <meta property="og:title" content="Carcassonne: Torres y Ladrones">
    <h1>Carcassonne Torres y Ladrones</h1>
    <script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Carcassonne Torres y Ladrones' })}</script>`;
  const titles = pageTitles(html);
  assert.ok(titles.includes('Carcassonne Torres y Ladrones'));
  assert.ok(titles.includes('Carcassonne: Torres y Ladrones'));
});

test('expansion markers with spaced numbers are ignored', () => {
  assert.ok(
    nameScore('Carcassonne Torres y Ladrones Exp. 4', 'Carcassonne: Torres y Ladrones') >=
      nameMatchThreshold
  );
});
