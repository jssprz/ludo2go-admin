type PromotionContentInput = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  activationMode: string;
  conditions: unknown;
  benefits: unknown;
  currency: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  promoCodes: string[];
};

type CarouselDisplayOptions = {
  desktopImage?: string | null;
  mobileImage?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function formatMoney(amount: unknown, currency: string): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('es-CL')} ${currency}`;
  }
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(new Date(value));
}

function describeApplicationScope(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const scopes: Record<string, string> = {
    order: 'en el total de la compra',
    second_eligible_item: 'en el segundo producto elegible',
    all_eligible_items: 'en todos los productos elegibles',
    cheapest_item: 'en el producto de menor precio',
    cheapest_eligible_item: 'en el producto elegible de menor precio',
    most_expensive_eligible_item: 'en el producto elegible de mayor precio',
    order_item: 'en un producto',
    shipping: 'en el envío',
  };
  return scopes[value] ?? null;
}

function describeBenefit(raw: unknown, currency: string): string {
  const benefits = Array.isArray(raw) ? raw : [raw];
  const summaries = benefits.map((value) => {
    const benefit = asObject(value);
    if (benefit.type === 'percentage' && typeof benefit.percentage === 'number') {
      const cap = formatMoney(benefit.maxDiscountAmount, currency);
      const scope = describeApplicationScope(benefit.appliesTo);
      return `${benefit.percentage}% de descuento${scope ? ` ${scope}` : ''}${cap ? ` (tope ${cap})` : ''}`;
    }
    if (benefit.type === 'fixed_amount') {
      const amount = formatMoney(benefit.amount, currency);
      const scope = describeApplicationScope(benefit.appliesTo);
      return amount ? `${amount} de descuento${scope ? ` ${scope}` : ''}` : null;
    }
    if (benefit.type === 'free_shipping') return 'Envío gratis';
    const label = typeof benefit.customerLabel === 'string' ? benefit.customerLabel.trim() : '';
    return label || null;
  }).filter((summary): summary is string => Boolean(summary));
  return summaries.join(' + ') || 'Beneficio especial';
}

function describeConditions(raw: unknown, currency: string): string[] {
  const conditions = asObject(raw);
  const summary: string[] = [];
  if (typeof conditions.minimumQuantity === 'number' && conditions.minimumQuantity > 1) {
    summary.push(`Compra ${conditions.minimumQuantity} o más productos elegibles`);
  }
  const minimumSubtotal = formatMoney(conditions.minimumSubtotal, currency);
  if (minimumSubtotal) summary.push(`Compra mínima de ${minimumSubtotal}`);
  if (conditions.firstOrderOnly === true) summary.push('Válido en tu primera compra');
  if (Array.isArray(conditions.productIds) && conditions.productIds.length) summary.push('En productos seleccionados');
  if (Array.isArray(conditions.brandIds) && conditions.brandIds.length) summary.push('En marcas seleccionadas');
  if (Array.isArray(conditions.categoryIds) && conditions.categoryIds.length) summary.push('En categorías seleccionadas');
  if (Array.isArray(conditions.skus) && conditions.skus.length) summary.push('En variantes seleccionadas');
  if (Array.isArray(conditions.excludedProductIds) && conditions.excludedProductIds.length) summary.push('No aplica a productos excluidos');
  if (Array.isArray(conditions.excludedSkus) && conditions.excludedSkus.length) summary.push('No aplica a variantes excluidas');
  if (Array.isArray(conditions.productKinds) && conditions.productKinds.length) {
    summary.push(`Para ${conditions.productKinds.map(String).join(', ')}`);
  }
  if (Array.isArray(conditions.productTags) && conditions.productTags.length) {
    summary.push(`Selección: ${conditions.productTags.map(String).join(', ')}`);
  }
  return summary;
}

export function buildPromotionCarouselContent(
  promotion: PromotionContentInput,
  options: CarouselDisplayOptions = {}
) {
  const benefitText = describeBenefit(promotion.benefits, promotion.currency);
  const detailParts = [
    promotion.description?.trim(),
    benefitText,
    ...describeConditions(promotion.conditions, promotion.currency),
  ].filter((part): part is string => Boolean(part));

  if (promotion.activationMode === 'PROMO_CODE') {
    detailParts.push(promotion.promoCodes.length
      ? `Usa el código ${promotion.promoCodes.join(' o ')}`
      : 'Requiere código promocional');
  }
  if (promotion.startsAt) detailParts.push(`Válido desde ${formatDate(promotion.startsAt)}`);
  if (promotion.endsAt) detailParts.push(`Válido hasta ${formatDate(promotion.endsAt)}`);
  if (promotion.perCustomerLimit != null) {
    detailParts.push(`Máximo ${promotion.perCustomerLimit} por cliente`);
  }
  if (promotion.usageLimit != null) {
    const remaining = Math.max(0, promotion.usageLimit - promotion.usageCount);
    if (remaining > 0) detailParts.push(`Cupos disponibles: ${remaining}`);
  }

  const activationLabel = promotion.activationMode === 'PROMO_CODE'
    ? (promotion.promoCodes[0] || 'Código promocional')
    : 'Oferta especial';
  const cta = {
    text: options.ctaText?.trim() || 'Ver promoción',
    url: options.ctaUrl?.trim() || '/',
    type: /^https?:\/\//i.test(options.ctaUrl?.trim() || '') ? 'EXTERNAL' : 'INTERNAL',
    target: 'SAME_TAB',
  };

  return {
    headline: promotion.name,
    subheadline: detailParts.join(' · '),
    badge: activationLabel,
    image: {
      desktop: options.desktopImage?.trim() || '',
      mobile: options.mobileImage?.trim() || '',
    },
    cta,
    theme: { style: 'dark', accent: '#e4572e' },
    promotion: {
      id: promotion.id,
      name: promotion.name,
      activationMode: promotion.activationMode,
      currency: promotion.currency,
      benefits: promotion.benefits,
      conditions: promotion.conditions,
      startsAt: promotion.startsAt ? new Date(promotion.startsAt).toISOString() : null,
      endsAt: promotion.endsAt ? new Date(promotion.endsAt).toISOString() : null,
      usageLimit: promotion.usageLimit,
      perCustomerLimit: promotion.perCustomerLimit,
      promoCodes: promotion.promoCodes,
    },
  };
}

export type { PromotionContentInput };