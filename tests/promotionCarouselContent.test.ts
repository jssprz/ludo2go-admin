import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromotionCarouselContent } from '../lib/promotion-carousel-content';

const promotion = {
  id: 'promo-1',
  name: 'Game night offer',
  description: 'A limited-time deal',
  status: 'ACTIVE',
  activationMode: 'PROMO_CODE',
  conditions: {
    minimumQuantity: 2,
    minimumSubtotal: 20000,
    firstOrderOnly: true,
    productIds: ['game-1'],
  },
  benefits: { type: 'percentage', percentage: 20, appliesTo: 'all_eligible_items', maxDiscountAmount: 10000 },
  currency: 'CLP',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-31T00:00:00.000Z',
  usageLimit: 100,
  usageCount: 75,
  perCustomerLimit: 1,
  promoCodes: ['NOCHE20'],
};

test('builds readable promo copy and retains promotion configuration in payload', () => {
  const payload = buildPromotionCarouselContent(promotion, {
    desktopImage: 'https://cdn.example.test/desktop.jpg',
    mobileImage: 'https://cdn.example.test/mobile.jpg',
    ctaText: 'Shop now',
    ctaUrl: '/collections/games',
  });

  assert.equal(payload.headline, promotion.name);
  assert.equal(payload.badge, 'NOCHE20');
  assert.match(payload.subheadline, /20% de descuento/);
  assert.match(payload.subheadline, /todos los productos elegibles/);
  assert.match(payload.subheadline, /Compra 2 o más productos elegibles/);
  assert.match(payload.subheadline, /Usa el código NOCHE20/);
  assert.match(payload.subheadline, /Válido hasta/);
  assert.match(payload.subheadline, /Cupos disponibles: 25/);
  assert.equal(payload.image.desktop, 'https://cdn.example.test/desktop.jpg');
  assert.equal(payload.cta.text, 'Shop now');
  assert.equal(payload.cta.url, '/collections/games');
  assert.deepEqual(payload.promotion.benefits, promotion.benefits);
  assert.deepEqual(payload.promotion.conditions, promotion.conditions);
});

test('describes free shipping promotions with a fallback badge when no code exists', () => {
  const payload = buildPromotionCarouselContent({
    ...promotion,
    activationMode: 'AUTOMATIC',
    conditions: {},
    benefits: { type: 'free_shipping' },
    promoCodes: [],
    endsAt: null,
    usageLimit: null,
    perCustomerLimit: null,
  });

  assert.equal(payload.badge, 'Oferta especial');
  assert.match(payload.subheadline, /Envío gratis/);
  assert.doesNotMatch(payload.subheadline, /código promocional/i);
});