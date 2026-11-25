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
  mercadopago: { percent: 3.19, fixed: 0 },
  transfer: { percent: 0, fixed: 0 },
  cash: { percent: 0, fixed: 0 },
};

export const PAYMENT_COMMISSION_VAT = 0.19;

// Failed, pending and refunded payments do not generate a commission cost.
const COMMISSION_STATUSES = new Set(['authorized', 'captured', 'approved']);

export type CommissionPayment = { method: string; amount: number; status: string };

function webpayMethod(code: unknown): string {
  if (code === 'VD' || code === 'VP') return 'webpay_debit';
  if (typeof code === 'string' && ['VN', 'VC', 'SI', 'S2', 'NC'].includes(code)) return 'webpay_credit';
  return 'webpay';
}

export function resolveCommissionPayments(order: {
  payments: CommissionPayment[];
  total: number;
  notes?: string | null;
}): CommissionPayment[] {
  // Payment records are authoritative; notes must not duplicate attempts or charges.
  if (!order.notes) return order.payments;
  let notes: unknown;
  try {
    notes = JSON.parse(order.notes);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return order.payments; // Order notes may also be ordinary text.
  }
  if (!notes || typeof notes !== 'object' || !('paymentMethod' in notes)) return order.payments;
  if (notes.paymentMethod === 'webpay' && 'webpay' in notes
    && notes.webpay && typeof notes.webpay === 'object') {
    const webpay = notes.webpay;
    const result = 'result' in webpay && webpay.result && typeof webpay.result === 'object'
      ? webpay.result
      : null;
    const method = webpayMethod(result && 'payment_type_code' in result ? result.payment_type_code : null);
    if (order.payments.length > 0) {
      return order.payments.map((payment) => payment.method === 'webpay'
        ? { ...payment, method }
        : payment);
    }
    const status = result && 'status' in result && typeof result.status === 'string'
      ? result.status
      : 'status' in webpay && typeof webpay.status === 'string' ? webpay.status : null;
    if (status === null) return order.payments;
    const amount = result && 'amount' in result
      && typeof result.amount === 'number' && Number.isFinite(result.amount) && result.amount >= 0
      ? result.amount
      : order.total;
    const rejected = result && 'response_code' in result && result.response_code !== 0;
    return [{ method, amount, status: rejected ? 'rejected' : status }];
  }
  if (order.payments.length > 0) return order.payments;
  if (notes.paymentMethod !== 'mercadopago'
    || !('mercadopagoStatus' in notes)
    || typeof notes.mercadopagoStatus !== 'string') return order.payments;
  // The notes contain attempt IDs, not amounts. Estimate one charge on the order total.
  return [{ method: 'mercadopago', amount: order.total, status: notes.mercadopagoStatus }];
}

export function paymentCommission(payment: CommissionPayment): number | null {
  if (!COMMISSION_STATUSES.has(payment.status.toLowerCase())) return 0;
  const rate = PAYMENT_COMMISSION_RATES[payment.method];
  if (!rate) return null;
  const net = (payment.amount * rate.percent) / 100 + rate.fixed;
  return Math.round(net * (1 + PAYMENT_COMMISSION_VAT));
}

export function totalPaymentCommission(payments: CommissionPayment[]): number | null {
  let total = 0;
  for (const payment of payments) {
    const commission = paymentCommission(payment);
    if (commission === null) return null;
    total += commission;
  }
  return total;
}
