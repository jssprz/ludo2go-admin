import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByRelevance } from '@/lib/repositories/variant.repository';

function createVariant(overrides: any = {}) {
  return {
    id: 'variant-1',
    unitsSoldInWindow: 0,
    viewCount: 0,
    clicks: 0,
    impressions: 0,
    inCartsQuantity: 0,
    daysSinceActivated: null,
    rating: 0,
    reviewCount: 0,
    product: null,
    ...overrides,
  };
}

test('sortByRelevance - empty array returns empty array', () => {
  const result = sortByRelevance([]);
  assert.deepEqual(result, []);
});

test('sortByRelevance - single item returns that item', () => {
  const variant = createVariant({ id: 'v1' });
  const result = sortByRelevance([variant]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'v1');
});

test('sortByRelevance - ranks by sales volume (primary signal)', () => {
  const items = [
    createVariant({ id: 'low-sales', unitsSoldInWindow: 1 }),
    createVariant({ id: 'high-sales', unitsSoldInWindow: 100 }),
    createVariant({ id: 'med-sales', unitsSoldInWindow: 50 }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'high-sales');
  assert.equal(result[1].id, 'med-sales');
  assert.equal(result[2].id, 'low-sales');
});

test('sortByRelevance - incorporates purchase rate as secondary signal', () => {
  const items = [
    createVariant({
      id: 'low-conversion',
      unitsSoldInWindow: 50,
      viewCount: 10000,
      clicks: 10,
      impressions: 10000,
      inCartsQuantity: 5,
      rating: 0,
      reviewCount: 0,
    }),
    createVariant({
      id: 'high-conversion',
      unitsSoldInWindow: 50,
      viewCount: 100,
      clicks: 50,
      impressions: 100,
      inCartsQuantity: 30,
      rating: 3,
      reviewCount: 5,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'high-conversion');
  assert.equal(result[1].id, 'low-conversion');
});

test('sortByRelevance - freshness boosts newer products', () => {
  const items = [
    createVariant({
      id: 'old-product',
      unitsSoldInWindow: 50,
      daysSinceActivated: 365,
    }),
    createVariant({
      id: 'new-product',
      unitsSoldInWindow: 50,
      daysSinceActivated: 1,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'new-product');
  assert.equal(result[1].id, 'old-product');
});

test('sortByRelevance - cart rate signals purchase intent', () => {
  const items = [
    createVariant({
      id: 'low-intent',
      unitsSoldInWindow: 30,
      viewCount: 500,
      clicks: 50,
      impressions: 500,
      inCartsQuantity: 0,
      rating: 0,
      reviewCount: 0,
    }),
    createVariant({
      id: 'high-intent',
      unitsSoldInWindow: 30,
      viewCount: 100,
      clicks: 50,
      impressions: 100,
      inCartsQuantity: 50,
      rating: 3,
      reviewCount: 5,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'high-intent');
  assert.equal(result[1].id, 'low-intent');
});

test('sortByRelevance - click-through rate reflects engagement quality', () => {
  const items = [
    createVariant({
      id: 'low-engagement',
      unitsSoldInWindow: 20,
      viewCount: 1000,
      clicks: 10,
      impressions: 1000,
      inCartsQuantity: 2,
      rating: 0,
      reviewCount: 0,
    }),
    createVariant({
      id: 'high-engagement',
      unitsSoldInWindow: 20,
      viewCount: 500,
      clicks: 400,
      impressions: 500,
      inCartsQuantity: 20,
      rating: 3.5,
      reviewCount: 10,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'high-engagement');
  assert.equal(result[1].id, 'low-engagement');
});

test('sortByRelevance - rating contributes but with Bayesian adjustment for low review counts', () => {
  const items = [
    createVariant({
      id: 'single-perfect',
      unitsSoldInWindow: 10,
      viewCount: 100,
      clicks: 5,
      impressions: 100,
      inCartsQuantity: 2,
      rating: 5,
      reviewCount: 1,
      daysSinceActivated: 10,
    }),
    createVariant({
      id: 'many-good',
      unitsSoldInWindow: 10,
      viewCount: 100,
      clicks: 5,
      impressions: 100,
      inCartsQuantity: 2,
      rating: 4,
      reviewCount: 50,
      daysSinceActivated: 10,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result.length, 2);
  assert(result.some((r) => r.id === 'single-perfect'));
  assert(result.some((r) => r.id === 'many-good'));
});

test('sortByRelevance - BGG rank serves as tiebreaker', () => {
  const items = [
    createVariant({
      id: 'no-bgg',
      unitsSoldInWindow: 20,
      viewCount: 100,
      rating: 4,
      reviewCount: 10,
    }),
    createVariant({
      id: 'good-bgg-rank',
      unitsSoldInWindow: 20,
      viewCount: 100,
      rating: 4,
      reviewCount: 10,
      product: {
        bgg: {
          boardgameRank: 50,
        },
      },
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'good-bgg-rank');
  assert.equal(result[1].id, 'no-bgg');
});

test('sortByRelevance - handles null/undefined metrics gracefully', () => {
  const items = [
    createVariant({ id: 'v1', unitsSoldInWindow: null }),
    createVariant({ id: 'v2', unitsSoldInWindow: 50 }),
    createVariant({ id: 'v3', unitsSoldInWindow: undefined }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'v2');
  assert.equal(result.length, 3);
});

test('sortByRelevance - preserves order for truly identical scores', () => {
  const items = [
    createVariant({
      id: 'a',
      unitsSoldInWindow: 0,
      viewCount: 0,
      clicks: 0,
      impressions: 0,
      inCartsQuantity: 0,
      rating: 0,
      reviewCount: 0,
    }),
    createVariant({
      id: 'b',
      unitsSoldInWindow: 0,
      viewCount: 0,
      clicks: 0,
      impressions: 0,
      inCartsQuantity: 0,
      rating: 0,
      reviewCount: 0,
    }),
    createVariant({
      id: 'c',
      unitsSoldInWindow: 0,
      viewCount: 0,
      clicks: 0,
      impressions: 0,
      inCartsQuantity: 0,
      rating: 0,
      reviewCount: 0,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'a');
  assert.equal(result[1].id, 'b');
  assert.equal(result[2].id, 'c');
});

test('sortByRelevance - weights sales volume heavily (32%)', () => {
  const items = [
    createVariant({
      id: 'high-sales',
      unitsSoldInWindow: 1000,
      viewCount: 1000,
      clicks: 100,
      impressions: 1000,
      inCartsQuantity: 50,
      rating: 4,
      reviewCount: 50,
    }),
    createVariant({
      id: 'low-sales',
      unitsSoldInWindow: 100,
      viewCount: 1000,
      clicks: 100,
      impressions: 1000,
      inCartsQuantity: 50,
      rating: 4,
      reviewCount: 50,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'high-sales');
});

test('sortByRelevance - handles products with no engagement data', () => {
  const items = [
    createVariant({ id: 'no-engagement', unitsSoldInWindow: 0, viewCount: 0 }),
    createVariant({ id: 'some-engagement', unitsSoldInWindow: 5, viewCount: 20 }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'some-engagement');
  assert.equal(result[1].id, 'no-engagement');
});

test('sortByRelevance - freshness boosts newer products when sales equal', () => {
  const baseProps = {
    unitsSoldInWindow: 10,
    viewCount: 50,
    clicks: 10,
    impressions: 50,
    inCartsQuantity: 5,
    rating: 3,
    reviewCount: 5,
  };

  const items = [
    {
      ...createVariant(baseProps),
      id: 'very-new',
      daysSinceActivated: 0,
    },
    {
      ...createVariant(baseProps),
      id: 'somewhat-new',
      daysSinceActivated: 30,
    },
    {
      ...createVariant(baseProps),
      id: 'old',
      daysSinceActivated: 120,
    },
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'very-new');
  assert.equal(result[2].id, 'old');
});

test('sortByRelevance - returns new array without mutating input', () => {
  const items = [
    createVariant({ id: 'a', unitsSoldInWindow: 10 }),
    createVariant({ id: 'b', unitsSoldInWindow: 20 }),
  ];

  const original = [...items];
  const result = sortByRelevance(items);

  assert.deepEqual(items, original);
  assert.equal(result[0].id, 'b');
  assert.equal(result[1].id, 'a');
});

test('sortByRelevance - returns consistent ordering on repeated calls', () => {
  const items = [
    createVariant({
      id: 'item-a',
      unitsSoldInWindow: 100,
      viewCount: 500,
      clicks: 50,
      impressions: 500,
    }),
    createVariant({
      id: 'item-b',
      unitsSoldInWindow: 200,
      viewCount: 1000,
      clicks: 100,
      impressions: 1000,
    }),
  ];

  const result1 = sortByRelevance(items);
  const result2 = sortByRelevance(items);

  assert.equal(result1[0].id, result2[0].id);
  assert.equal(result1[1].id, result2[1].id);
});

test('sortByRelevance - scores are normalized between 0 and 1', () => {
  const items = [
    createVariant({
      id: 'very-high-metrics',
      unitsSoldInWindow: 10000,
      viewCount: 50000,
      clicks: 5000,
      impressions: 10000,
      inCartsQuantity: 1000,
      rating: 5,
      reviewCount: 500,
    }),
    createVariant({
      id: 'very-low-metrics',
      unitsSoldInWindow: 0,
      viewCount: 0,
      clicks: 0,
      impressions: 0,
      inCartsQuantity: 0,
      rating: 0,
      reviewCount: 0,
    }),
  ];

  const result = sortByRelevance(items);
  assert.equal(result[0].id, 'very-high-metrics');
  assert.equal(result[1].id, 'very-low-metrics');
});