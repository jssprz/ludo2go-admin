export type PriceRuleCarouselInput = {
  id: string;
  name: string;
  badge: string | null;
  description: string | null;
  active: boolean;
  applied: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  currency: string;
  sourcePriceType: string;
  computationType: string;
  fixedAmount: number | null;
  percentageDiscount: string | null;
  fixedDiscountAmount: number | null;
};

type DisplayOptions = {
  desktopImage?: string | null;
  mobileImage?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
};

export function buildPriceRuleCarouselContent(rule: PriceRuleCarouselInput, options: DisplayOptions = {}) {
  const money = (amount: number | null) => amount == null ? '' : new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: rule.currency, maximumFractionDigits: 0,
  }).format(amount);
  const discount = rule.computationType === 'percentage_discount'
    ? `${Number(rule.percentageDiscount ?? 0)}% de descuento`
    : rule.computationType === 'fixed_discount'
      ? `${money(rule.fixedDiscountAmount)} de descuento`
      : `Precio especial ${money(rule.fixedAmount)}`;
  const date = (value: Date | string) => new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago',
  }).format(new Date(value));
  const details = [rule.description?.trim(), discount];
  if (rule.startsAt) details.push(`Válido desde ${date(rule.startsAt)}`);
  if (rule.endsAt) details.push(`Válido hasta ${date(rule.endsAt)}`);
  const url = options.ctaUrl?.trim() || '/';

  return {
    headline: rule.name,
    badge: rule.badge?.trim() || 'Precio especial',
    subheadline: details.filter(Boolean).join(' · '),
    image: { desktop: options.desktopImage?.trim() || '', mobile: options.mobileImage?.trim() || '' },
    cta: {
      text: options.ctaText?.trim() || 'Ver oferta',
      url,
      type: /^https?:\/\//i.test(url) ? 'EXTERNAL' : 'INTERNAL',
      target: /^https?:\/\//i.test(url) ? 'NEW_TAB' : 'SAME_TAB',
    },
    theme: { style: 'dark', accent: '#e4572e' },
    priceRule: {
      id: rule.id,
      name: rule.name,
      currency: rule.currency,
      sourcePriceType: rule.sourcePriceType,
      computationType: rule.computationType,
      fixedAmount: rule.fixedAmount,
      percentageDiscount: rule.percentageDiscount,
      fixedDiscountAmount: rule.fixedDiscountAmount,
      startsAt: rule.startsAt ? new Date(rule.startsAt).toISOString() : null,
      endsAt: rule.endsAt ? new Date(rule.endsAt).toISOString() : null,
    },
  };
}