import { expect, test } from 'vitest';
import { calculateOrderProfit, type OrderProfitCostPrice } from '../lib/order-profit';
import { paymentCommission, resolveCommissionPayments } from '../lib/payment-commissions';

const createdAt = new Date('2026-07-14T12:00:00Z');

const item = {
  id: 'item-1',
  variantId: 'variant-1',
  quantity: 3,
  cancelledQuantity: 1,
  unitPrice: 2000,
  currency: 'CLP',
  isGift: false,
};

const costPrice: OrderProfitCostPrice = {
  variantId: 'variant-1',
  amount: 1000,
  currency: 'CLP',
  taxIncluded: true,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  effectiveTo: null,
};

test('calculates gross gain for the remaining paid quantity', () => {
  expect(calculateOrderProfit(
    { createdAt, status: 'delivered', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [item] },
    [costPrice],
    []
  )).toEqual({
    total: 2000,
    cost: 2000,
    commission: 0,
    mercadoLibreCommission: null,
    lines: [{ itemId: 'item-1', amount: 2000, cost: 2000 }],
  });
});

test('deducts the Mercado Libre sale charge for customers with an ml- email', () => {
  const result = calculateOrderProfit(
    {
      createdAt,
      status: 'delivered',
      currency: 'CLP',
      total: 4500,
      shipping: 500,
      customerEmail: 'ML-customer@example.com',
      payments: [],
      items: [item],
    },
    [costPrice],
    []
  );
  expect(result.mercadoLibreCommission).toBe(600);
  expect(result.total).toBe(1400);
});

test('does not apply the Mercado Libre sale charge to other or missing customer emails', () => {
  for (const customerEmail of ['customer@example.com', null, undefined]) {
    const result = calculateOrderProfit(
      {
        createdAt,
        status: 'delivered',
        currency: 'CLP',
        total: 4500,
        shipping: 500,
        customerEmail,
        payments: [],
        items: [item],
      },
      [costPrice],
      []
    );
    expect(result.mercadoLibreCommission).toBeNull();
    expect(result.total).toBe(2000);
  }
});

test('prefers the cost price effective at order time, falling back to any active cost', () => {
  const future = { ...costPrice, amount: 500, taxIncluded: true, effectiveFrom: new Date('2026-08-01T00:00:00Z') };
  const run = (costs: OrderProfitCostPrice[]) => calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [item] }, costs, []
  ).total;
  expect(run([future, costPrice])).toBe(2000);
  expect(run([future])).toBe(3000);
});

test('includes the cost of gift items and returns unavailable for missing or mismatched costs', () => {
  const gift = { ...item, isGift: true };
  expect(calculateOrderProfit({ createdAt, status: 'processing', currency: 'CLP', total: 0, shipping: 0, payments: [], items: [gift] }, [costPrice], []).total)
    .toBe(-2000);
  expect(calculateOrderProfit({ createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [item] }, [], []).total)
    .toBeNull();
  expect(calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [{ ...item, currency: 'USD' }] },
    [costPrice],
    []
  ).total).toBeNull();
});

test('prefers the latest purchase cost, as the Inventory page does', () => {
  const purchase = {
    variantId: 'variant-1',
    unitCost: 500,
    quantity: 1,
    discount: 0,
    purchaseOrder: {
      createdAt: new Date('2026-07-01T00:00:00Z'),
      currency: 'CLP',
      subtotal: 500,
      tax: 95,
      shipping: 0,
      items: [{ discount: 0 }],
    },
  };
  expect(calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [item] },
    [costPrice],
    [purchase]
  ).total).toBe(2810);
});

test('treats a cancelled order as no sale', () => {
  expect(calculateOrderProfit({ createdAt, status: 'cancelled', currency: 'CLP', total: 4500, shipping: 500, payments: [], items: [item] }, [], []).total).toBe(0);
});

test('computes gain on total minus shipping, so order discounts and shipping are accounted for', () => {
  const run = (total: number, shipping: number) => calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total, shipping, payments: [], items: [item] }, [costPrice], []
  ).total;
  expect(run(4500, 500)).toBe(2000);
  expect(run(3500, 500)).toBe(1000);
  expect(run(4000, 0)).toBe(2000);
});

test('deducts payment commissions (with VAT) from the gain, ignoring failed payments', () => {
  const payments = [
    { method: 'card', amount: 4500, status: 'captured' },
    { method: 'wallet', amount: 1000, status: 'failed' },
  ];
  const result = calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments, items: [item] }, [costPrice], []
  );
  expect(result.commission).toBe(123);
  expect(result.total).toBe(2000 - 123);
});

test('deducts an approved Mercado Pago payment found only in notes, once for multiple attempt IDs', () => {
  const payments = resolveCommissionPayments({
    payments: [],
    total: 4500,
    notes: JSON.stringify({
      paymentMethod: 'mercadopago',
      mercadopagoPaymentId: '191317140958,191317198826',
      mercadopagoStatus: 'approved',
      promoDiscount: 11516,
    }),
  });
  expect(payments).toEqual([{ method: 'mercadopago', status: 'approved', amount: 4500 }]);
  const result = calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments, items: [item] },
    [costPrice], []
  );
  expect(result.commission).toBe(171);
  expect(result.total).toBe(1829);
});

test('payment records override notes without duplicating a charge or overriding a failed status', () => {
  const notes = JSON.stringify({ paymentMethod: 'mercadopago', mercadopagoStatus: 'approved' });
  for (const status of ['approved', 'captured', 'failed']) {
    const payments = [{ method: 'mercadopago_10d', amount: 100000, status }];
    expect(resolveCommissionPayments({ payments, total: 100000, notes })).toEqual(payments);
    expect(paymentCommission(payments[0])).toBe(status === 'failed' ? 0 : 3439);
  }
});

test('uses published gateway tariffs including VAT and recognizes the Mercado Pago alias', () => {
  const rates = {
    webpay_debit: 1773,
    webpay_credit: 2725,
    mercadopago_instant: 3796,
    mercadopago_10d: 3439,
    mercadopago: 3796,
    transfer: 0,
    cash: 0,
  };
  for (const [method, expected] of Object.entries(rates)) {
    expect(paymentCommission({ method, amount: 100000, status: 'approved' })).toBe(expected);
  }
  for (const status of ['pending', 'failed', 'refunded', 'rejected']) {
    expect(paymentCommission({ method: 'mercadopago', amount: 100000, status })).toBe(0);
  }
});

test('ordinary notes are ignored and unknown successful payment methods make gain unavailable', () => {
  for (const notes of ['plain text', 'null', '[]', '{}']) {
    expect(resolveCommissionPayments({ payments: [], total: 4500, notes })).toEqual([]);
  }
  const payments = [{ method: 'unknown_gateway', amount: 4500, status: 'captured' }];
  expect(paymentCommission(payments[0])).toBeNull();
  const result = calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 4500, shipping: 500, payments, items: [item] },
    [costPrice], []
  );
  expect(result.commission).toBeNull();
  expect(result.total).toBeNull();
});

test('Webpay notes select the debit rate and deduct the commission from gain', () => {
  const payments = resolveCommissionPayments({
    payments: [],
    total: 40150,
    notes: JSON.stringify({
      paymentMethod: 'webpay',
      webpay: {
        status: 'APPROVED',
        result: { amount: 40150, status: 'AUTHORIZED', payment_type_code: 'VD', response_code: 0 },
      },
    }),
  });
  expect(payments).toEqual([{ method: 'webpay_debit', amount: 40150, status: 'AUTHORIZED' }]);
  const result = calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', total: 40150, shipping: 500, payments, items: [item] },
    [costPrice], []
  );
  expect(result.commission).toBe(712);
  expect(result.total).toBe(36938);
});

test('Webpay notes distinguish payment types and use the gateway amount rather than the order total', () => {
  for (const code of ['VD', 'VP', 'VN', 'VC', 'SI', 'S2', 'NC', 'unknown']) {
    const payments = resolveCommissionPayments({
      payments: [], total: 100000,
      notes: JSON.stringify({
        paymentMethod: 'webpay',
        webpay: { result: { amount: 40150, status: 'AUTHORIZED', payment_type_code: code, response_code: 0 } },
      }),
    });
    expect(payments[0].amount).toBe(40150);
    expect(paymentCommission(payments[0])).toBe(
      code === 'unknown' ? null : ['VD', 'VP'].includes(code) ? 712 : 1094
    );
  }
});

test('Webpay records retain authoritative amounts and statuses while notes supply the payment type', () => {
  const notes = JSON.stringify({
    paymentMethod: 'webpay',
    webpay: { result: { amount: 40150, status: 'AUTHORIZED', payment_type_code: 'VD', response_code: 0 } },
  });
  const payments = resolveCommissionPayments({
    payments: [{ method: 'webpay', amount: 100000, status: 'failed' }],
    total: 40150, notes,
  });
  expect(payments).toEqual([{ method: 'webpay_debit', amount: 100000, status: 'failed' }]);
  expect(paymentCommission(payments[0])).toBe(0);
});

test('Webpay rejected responses incur no commission even if the status claims authorization', () => {
  const payments = resolveCommissionPayments({
    payments: [], total: 40150,
    notes: JSON.stringify({
      paymentMethod: 'webpay',
      webpay: { result: { amount: 40150, status: 'AUTHORIZED', payment_type_code: 'VD', response_code: -1 } },
    }),
  });
  expect(paymentCommission(payments[0])).toBe(0);
});
