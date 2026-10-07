import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPriceRuleCarouselContent } from '../lib/price-rule-carousel-content';

const rule = {
  id: 'rule-1', name: 'Winter sale', badge: 'Sale', description: 'Selected games',
  active: true, applied: true, startsAt: '2026-10-01T00:00:00.000Z', endsAt: null,
  currency: 'CLP', sourcePriceType: 'retail', computationType: 'percentage_discount',
  fixedAmount: null, percentageDiscount: '10.00', fixedDiscountAmount: null,
};

test('uses rule presentation fields and keeps the price-rule snapshot', () => {
  const payload = buildPriceRuleCarouselContent(rule, { ctaUrl: '/prices', desktopImage: 'https://example.com/game.jpg' });
  assert.equal(payload.headline, 'Winter sale');
  assert.equal(payload.badge, 'Sale');
  assert.match(payload.subheadline, /Selected games · 10% de descuento/);
  assert.equal(payload.image.desktop, 'https://example.com/game.jpg');
  assert.equal(payload.priceRule.id, rule.id);
  assert.equal(payload.cta.type, 'INTERNAL');
});

test('falls back to a price badge and describes fixed price rules', () => {
  const payload = buildPriceRuleCarouselContent({ ...rule, badge: null, computationType: 'set_fixed_amount', fixedAmount: 19990 }, { ctaUrl: 'https://example.com' });
  assert.equal(payload.badge, 'Precio especial');
  assert.match(payload.subheadline, /Precio especial/);
  assert.equal(payload.cta.type, 'EXTERNAL');
});