import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchaseOrderTotals, inferPurchaseOrderTaxOptions } from '../lib/purchase-order-tax';

test('discount before IVA reduces the tax base', () => {
  assert.deepEqual(calculatePurchaseOrderTotals(1000, 100, 0, false, false), {
    subtotal: 900, tax: 171, total: 1071,
  });
});

test('discount after IVA reduces the payable amount but not the tax base', () => {
  assert.deepEqual(calculatePurchaseOrderTotals(1000, 100, 0, false, true), {
    subtotal: 900, tax: 190, total: 1090,
  });
});

test('shipping is included in the tax base only when selected', () => {
  assert.equal(calculatePurchaseOrderTotals(1000, 100, 50, true, false).tax, 181);
  assert.equal(calculatePurchaseOrderTotals(1000, 100, 50, true, true).tax, 200);
});

test('reconstructs saved tax options from tax and line discounts', () => {
  for (const includeShippingInTax of [false, true]) {
    for (const discountAfterTax of [false, true]) {
      const totals = calculatePurchaseOrderTotals(1000, 100, 50, includeShippingInTax, discountAfterTax);
      assert.deepEqual(inferPurchaseOrderTaxOptions({
        ...totals, shipping: 50, items: [{ discount: 40 }, { discount: 60 }],
      }), { includeShippingInTax, discountAfterTax });
    }
  }
});