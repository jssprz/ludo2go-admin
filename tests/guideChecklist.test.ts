import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeGuideHtml, safeGuideUrl } from '../lib/guide-html';
import { blockAnchor } from '../lib/guide-blocks';
import { checkGuidePublication } from '../lib/guide-checklist';
import { loadGuideCatalogSlugs } from '../lib/guide-catalog';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const cover = { coverImageUrl: 'https://example.com/cover.jpg', coverImageAlt: 'Board games' };
const heading = { id: firstId, sortOrder: 0, type: 'heading' as const, title: 'Games' };

test('checklist HTML sanitization preserves formatting and removes unsafe content', () => {
  const html = sanitizeGuideHtml('<h2 style="text-align:center;color:red">Title</h2><p><strong>Bold</strong><u>Underline</u></p><script>alert(1)</script><img src="data:image/svg+xml,bad" onerror="bad()"><a href="javascript:bad">Bad</a>');
  assert.match(html, /<h2 style="text-align:center">Title<\/h2>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.doesNotMatch(html, /script|alert|onerror|javascript|data:|color:red/);
  assert.equal(safeGuideUrl('javascript:bad'), undefined);
});

test('publication checks empty HTML, required fields and catalog slugs without mutation', () => {
  assert.deepEqual(checkGuidePublication({ ...cover, blocks: [heading] }), []);
  const guide = { ...cover, blocks: [
    { ...heading, type: 'rich_text' as const, body: '<p>&nbsp;<br></p>' },
    { ...heading, id: secondId, type: 'product_recommendation' as const, data: { productSlug: 'unknown', ctaLabel: 'Shop' } }
  ] };
  const before = JSON.stringify(guide);
  const issues = checkGuidePublication(guide, { catalogSlugs: new Set(['scout']) });
  assert.ok(issues.some((issue) => issue.path === 'blocks.0.body' && /visible text/.test(issue.message)));
  assert.ok(issues.some((issue) => /Unknown product slug: unknown/.test(issue.message)));
  assert.ok(!issues.some((issue) => issue.path === 'blocks.1.data.ctaHref'));
  assert.equal(JSON.stringify(guide), before);
  assert.ok(checkGuidePublication({ ...cover, blocks: [{ ...heading, type: 'faq', data: { questions: [{ question: 'Why?' }] } }] }).some((issue) => issue.path === 'blocks.0.data.questions.0.answer'));
});

test('publication checks cover, block and embedded image descriptions', () => {
  const issues = checkGuidePublication({ coverImageUrl: 'javascript:bad', blocks: [
    { ...heading, type: 'image', imageUrl: 'https://example.com/game.jpg', imageAlt: '' },
    { ...heading, id: secondId, type: 'rich_text', body: '<p>Text</p><img src="data:image/png,bad" alt="">' }
  ] });
  for (const path of ['coverImageUrl', 'coverImageAlt', 'blocks.0.imageAlt', 'blocks.1.body.images.0.src', 'blocks.1.body.images.0.alt']) {
    assert.ok(issues.some((issue) => issue.path === path), path);
  }
});

test('publication checks paired CTAs and stable UUID anchor targets', () => {
  const issues = checkGuidePublication({ ...cover, blocks: [
    { ...heading, type: 'rich_text', body: `<p><a href="#${blockAnchor(secondId)}">Known</a><a href="#position-1">Unknown</a></p>` },
    { ...heading, id: secondId, type: 'hero', data: { title: 'Hero', ctaLabel: 'Missing destination' } }
  ] });
  assert.ok(!issues.some((issue) => issue.path === 'blocks.0.body.links.0.href'));
  assert.ok(issues.some((issue) => issue.path === 'blocks.0.body.links.1.href' && issue.message === 'Unknown block anchor'));
  assert.ok(issues.some((issue) => issue.path === 'blocks.1.data.ctaHref'));
});

test('publication checks legacy fields only when blocks are absent', () => {
  assert.deepEqual(checkGuidePublication({ ...cover, blocks: [heading], intro: '<p></p>', content: '<a href="javascript:bad">Old</a>' }), []);
  assert.ok(checkGuidePublication({ ...cover, blocks: [], content: '<p></p>' }).some((issue) => issue.path === 'content'));
});

test('catalog checklist lookup deduplicates queries and matches exact slugs', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(String(input));
    assert.equal(init?.credentials, 'same-origin');
    return Response.json([{ productSlug: 'scout-expansion' }, { productSlug: 'scout' }]);
  };
  try {
    assert.deepEqual(await loadGuideCatalogSlugs(['scout', 'scout', 'unknown']), new Set(['scout']));
    assert.deepEqual(calls, ['/api/variants/search?q=scout', '/api/variants/search?q=unknown']);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(loadGuideCatalogSlugs(['scout']), /Catalog could not be loaded/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});