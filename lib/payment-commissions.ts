export type PaymentCommissionRate = { percent: number; fixed: number };

// Gateway commission rates (percent of amount + fixed CLP), before 19% VAT. Nov 2026 published tariffs.
export const PAYMENT_COMMISSION_RATES: Record<string, PaymentCommissionRate> = {
  webpay_debit: { percent: 1.49, fixed: 0 },
  webpay_credit: { percent: 2.29, fixed: 0 },
  mercadopago_instant: { percent: 3.19, fixed: 0 },
  mercadopago_10d: { percent: 2.89, fixed: 0 },
  // Legacy generic methods: assume the most common gateway option.
  card: { percent: 2.29, fixed: 0 },
  wallet: { percent: 3.19, fixed: 0 },
  transfer: { percent: 0, fixed: 0 },
  cash: { percent: 0, fixed: 0 },
};

export const PAYMENT_COMMISSION_VAT = 0.19;

// Failed, pending and refunded payments do not generate a commission cost.
const COMMISSION_STATUSES = new Set(['authorized', 'captured']);

export type CommissionPayment = { method: string; amount: number; status: string };

export function paymentCommission(payment: CommissionPayment): number {
  if (!COMMISSION_STATUSES.has(payment.status)) return 0;
  const rate = PAYMENT_COMMISSION_RATES[payment.method];
  if (!rate) return 0;
  const net = (payment.amount * rate.percent) / 100 + rate.fixed;
  return Math.round(net * (1 + PAYMENT_COMMISSION_VAT));
}

export function totalPaymentCommission(payments: CommissionPayment[]): number {
  return payments.reduce((sum, payment) => sum + paymentCommission(payment), 0);
}
