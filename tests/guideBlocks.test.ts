import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { blockAnchor, blockDefinitions, blockSummary, getGuideDisplayBlocks, getProductSlugs, guideBlockSchema, guideBlockSortSchema, guideBlockTypes } from '../lib/guide-blocks';
import { deleteGuideBlock, GuideBlockError, guideBlockErrorResponse, parseGuideBlockRequest, parseGuideBlockSortRequest, saveGuideBlock, sortGuideBlocks } from '../lib/guide-block-persistence';

test('defines all fourteen block types and preserves existing structured keys', () => {
  assert.equal(guideBlockTypes.length, 14);
  assert.deepEqual(Object.keys(blockDefinitions), [...guideBlockTypes]);
  const samples = {
    rich_text: { body: '<p>Text</p>' }, heading: { title: 'Title' },
    hero: { data: { title: 'Travel', ctaHref: '#block-123', ctaLabel: 'Shop', extra: true } },
    intro: { data: { content: 'Introduction' } }, image: { imageUrl: 'https://example.com/image.png' },
    criteria: { data: { items: [{ title: 'Small', description: 'Compact' }] } }, quote: { body: 'Quote' },
    faq: { data: { questions: [{ question: 'Why?', answer: 'Because.' }] } },
    product_list: { data: { productSlugs: ['scout'] } }, product_recommendation: { data: { productSlug: 'scout', bestFor: ['Travel'] } },
    comparison: { data: { items: [{ label: 'For families', products: ['Love Letter', 'Coup X'] }] } },
    product_grid: { data: { productSlugs: ['scout'] } }, cta: { buttonText: 'Shop', buttonUrl: '/games' },
    final_cta: { data: { ctaLabel: 'Shop', ctaHref: '/games' } }
  };
  for (const type of guideBlockTypes) assert.equal(guideBlockSchema.safeParse({ type, ...samples[type] }).success, true, type);
  assert.equal(guideBlockSchema.parse({ type: 'hero', ...samples.hero }).data?.extra, true);
});

test('rejects unknown types, wrong JSON shapes and missing nested required fields with inline paths', () => {
  for (const input of [{ type: 'unknown' }, { type: 'faq', data: [] }, { type: 'heading' }, { type: 'product_grid', data: { productSlugs: [] } }, { type: 'cta', buttonText: 'Shop', buttonUrl: 'javascript:alert(1)' }]) assert.equal(guideBlockSchema.safeParse(input).success, false);
  const result = guideBlockSchema.safeParse({ type: 'faq', data: { questions: [{ question: 'Why?' }] } });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(result.error.issues[0].path, ['data', 'questions', 0, 'answer']);
});

test('extracts only actual slug references, not comparison display names', () => {
  assert.deepEqual(getProductSlugs({ productSlug: ' scout ', productSlugs: ['scout', 'love-letter', null, ''] }), ['scout', 'love-letter']);
  assert.equal(guideBlockSchema.parse({ type: 'product_recommendation', data: { productSlug: ' scout ' } }).data?.productSlug, 'scout');
  assert.deepEqual(getProductSlugs({ items: [{ products: ['Love Letter'] }] }), []);
  assert.deepEqual(getProductSlugs(null), []);
});

test('uses stable ID anchors and suppresses legacy fallback when blocks exist', () => {
  assert.equal(blockAnchor('a-uuid'), 'block-a-uuid');
  const result = getGuideDisplayBlocks({ blocks: [{ type: 'hero', sortOrder: 2 }, { type: 'intro', sortOrder: 0 }], intro: 'Old intro', content: 'Duplicated article' });
  assert.equal(result.blocks[0].type, 'intro');
  assert.equal(result.content, null);
  assert.equal(result.intro, null);
  assert.equal(getGuideDisplayBlocks({ blocks: [], content: 'Legacy article' }).content, 'Legacy article');
  assert.equal(blockSummary({ type: 'intro', data: { content: '<p>Hello</p>' } }), 'Hello');
});

test('sorting rejects duplicate IDs, duplicate positions, gaps, and non-integers', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  assert.equal(guideBlockSortSchema.safeParse({ updates: [{ id: first, sortOrder: 1 }, { id: second, sortOrder: 0 }] }).success, true);
  for (const updates of [[{ id: first, sortOrder: 0 }, { id: first, sortOrder: 1 }], [{ id: first, sortOrder: 0 }, { id: second, sortOrder: 0 }], [{ id: first, sortOrder: 2 }], [{ id: first, sortOrder: 0.5 }]]) assert.equal(guideBlockSortSchema.safeParse({ updates }).success, false);
});

const guideId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const thirdId = '33333333-3333-4333-8333-333333333333';

function fixture() {
  const blocks = [
    { id: firstId, guideId, sortOrder: 0 },
    { id: secondId, guideId, sortOrder: 4 },
    { id: thirdId, guideId, sortOrder: 8 }
  ];
  const products = [{ slug: 'scout', variants: [{ id: 'linked-variant' }, { id: 'new-variant' }] }];
  const links = [{ guideId, variantId: 'linked-variant', sortOrder: 2 }, { guideId, variantId: 'inherited-unused-variant', sortOrder: 6 }];
  const writes: { operation: string; data: Record<string, unknown> }[] = [];
  const transaction = {
    guide: { findUnique: async () => ({ id: guideId }) },
    product: { findMany: async ({ where }: { where: { slug: { in: string[] } } }) => products.filter((product) => where.slug.in.includes(product.slug)) },
    guideProductVariant: {
      findMany: async () => links,
      createMany: async ({ data }: { data: typeof links }) => { links.push(...data); writes.push({ operation: 'links', data: { links: data } }); }
    },
    guideBlock: {
      findUnique: async ({ where }: { where: { id: string } }) => blocks.find((block) => block.id === where.id) ?? null,
      findMany: async ({ where }: { where: { id?: { in: string[] }; guideId?: string } }) => blocks.filter((block) => where.id ? where.id.in.includes(block.id) : block.guideId === where.guideId).sort((left, right) => left.sortOrder - right.sortOrder),
      aggregate: async () => ({ _max: { sortOrder: blocks.length ? Math.max(...blocks.map((block) => block.sortOrder)) : null } }),
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ operation: 'create', data }); return { id: 'created', ...data }; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        writes.push({ operation: 'update', data: { id: where.id, ...data } });
        const block = blocks.find((item) => item.id === where.id)!;
        Object.assign(block, data);
        return block;
      },
      delete: async ({ where }: { where: { id: string } }) => { blocks.splice(blocks.findIndex((block) => block.id === where.id), 1); writes.push({ operation: 'delete', data: { id: where.id } }); }
    }
  } as unknown as Prisma.TransactionClient;
  return { transaction, blocks, links, products, writes };
}

test('request parsing returns 400 inline issues for invalid JSON, data types and missing create guide IDs', async () => {
  for (const body of ['{', JSON.stringify({ type: 'faq', data: 'not an object' }), JSON.stringify({ type: 'heading', title: 'Heading' })]) {
    await assert.rejects(() => parseGuideBlockRequest(new Request('https://example.com', { method: 'POST', body }), true), (error: unknown) => {
      const response = guideBlockErrorResponse(error);
      assert.equal(response?.status, 400);
      assert.ok(response?.body.issues?.length);
      return true;
    });
  }
  await assert.rejects(() => parseGuideBlockSortRequest(new Request('https://example.com', { method: 'PUT', body: '{' })), GuideBlockError);
});

test('create appends after maximum order and adds all missing variants without removing inherited links', async () => {
  const state = fixture();
  await saveGuideBlock(state.transaction, guideBlockSchema.parse({ guideId, type: 'product_recommendation', sortOrder: 1, data: { productSlug: 'scout' } }));
  assert.equal(state.writes.find((write) => write.operation === 'create')?.data.sortOrder, 9);
  assert.deepEqual(state.links.map((link) => link.variantId), ['linked-variant', 'inherited-unused-variant', 'new-variant']);
  assert.equal(state.links[2].sortOrder, 7);
  assert.equal(state.writes.filter((write) => write.operation === 'links').length, 1);
});

test('first block starts at zero and update cannot move guides or reorder blocks', async () => {
  const state = fixture();
  await saveGuideBlock(state.transaction, guideBlockSchema.parse({ type: 'heading', title: 'Updated', sortOrder: 100 }), secondId);
  assert.equal(state.blocks[1].sortOrder, 4);
  assert.equal(state.writes[0].data.sortOrder, undefined);
  await assert.rejects(() => saveGuideBlock(state.transaction, guideBlockSchema.parse({ type: 'heading', title: 'Moved', guideId: firstId }), secondId), GuideBlockError);
  state.blocks.length = 0;
  await saveGuideBlock(state.transaction, guideBlockSchema.parse({ guideId, type: 'heading', title: 'First' }));
  assert.equal(state.writes.find((write) => write.operation === 'create')?.data.sortOrder, 0);
});

test('unknown slugs are rejected before any writes and unchanged links are not recreated', async () => {
  const state = fixture();
  await assert.rejects(() => saveGuideBlock(state.transaction, guideBlockSchema.parse({ guideId, type: 'product_grid', data: { productSlugs: ['scout', 'unknown'] } })), (error: unknown) => {
    assert.ok(error instanceof GuideBlockError);
    assert.equal(error.status, 400);
    assert.deepEqual(error.issues[0].path, ['data', 'productSlugs']);
    return true;
  });
  assert.equal(state.writes.length, 0);
  state.products[0].variants = [{ id: 'linked-variant' }];
  await saveGuideBlock(state.transaction, guideBlockSchema.parse({ guideId, type: 'product_grid', data: { productSlugs: ['scout'] } }));
  assert.equal(state.writes.some((write) => write.operation === 'links'), false);
});

test('reordering requires a complete set of existing blocks belonging to one guide', async () => {
  const state = fixture();
  await assert.rejects(() => sortGuideBlocks(state.transaction, [{ id: firstId, sortOrder: 0 }]), GuideBlockError);
  await assert.rejects(() => sortGuideBlocks(state.transaction, [{ id: guideId, sortOrder: 0 }]), GuideBlockError);
  state.blocks[2].guideId = secondId;
  const updates = [{ id: firstId, sortOrder: 2 }, { id: secondId, sortOrder: 0 }, { id: thirdId, sortOrder: 1 }];
  await assert.rejects(() => sortGuideBlocks(state.transaction, updates), GuideBlockError);
  assert.equal(state.writes.length, 0);
  state.blocks[2].guideId = guideId;
  await sortGuideBlocks(state.transaction, updates);
  assert.deepEqual(state.blocks.map((block) => block.sortOrder), [2, 0, 1]);
});

test('delete normalizes remaining orders and preserves all editorial variant links', async () => {
  const state = fixture();
  await deleteGuideBlock(state.transaction, firstId);
  assert.deepEqual(state.blocks.map((block) => block.sortOrder), [0, 1]);
  assert.equal(state.links.length, 2);
  await assert.rejects(() => deleteGuideBlock(state.transaction, firstId), (error: unknown) => error instanceof GuideBlockError && error.status === 404);
});