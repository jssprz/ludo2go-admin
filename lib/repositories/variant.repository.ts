type VariantRelevanceInput = {
  id: string;
  unitsSoldInWindow: number | null | undefined;
  viewCount: number | null | undefined;
  clicks: number | null | undefined;
  impressions: number | null | undefined;
  inCartsQuantity: number | null | undefined;
  daysSinceActivated: number | null;
  rating: number | null;
  reviewCount: number | null | undefined;
  product?: {
    bgg?: {
      boardgameRank: number | null;
    } | null;
  } | null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const percentile95 = (values: number[]) => {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0;
};

const normalizeLog = (value: number, p95: number) => {
  if (value <= 0 || p95 <= 0) return 0;

  return clamp01(Math.log1p(value) / Math.log1p(p95));
};

const smoothedRate = (
  successes: number,
  opportunities: number,
  priorRate: number,
  priorStrength: number
) => {
  return (successes + priorRate * priorStrength) / (opportunities + priorStrength);
};

export function scoreByRelevance<T extends VariantRelevanceInput>(items: T[]): Map<string, number> {
  if (items.length <= 1) {
    return new Map(items.map((item) => [item.id, 1]));
  }

  const metrics = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    sales: Math.max(item.unitsSoldInWindow ?? 0, 0),
    views: Math.max(item.viewCount ?? 0, 0),
    clicks: Math.max(item.clicks ?? 0, 0),
    impressions: Math.max(item.impressions ?? 0, 0),
    carts: Math.max(item.inCartsQuantity ?? 0, 0),
    daysSinceActivated: item.daysSinceActivated,
    rating: item.rating ?? 0,
    reviewCount: Math.max(item.reviewCount ?? 0, 0),
    bggRank: item.product?.bgg?.boardgameRank ?? null,
  }));

  const totals = metrics.reduce(
    (acc, metric) => {
      acc.sales += metric.sales;
      acc.views += metric.views;
      acc.clicks += metric.clicks;
      acc.impressions += metric.impressions;
      acc.carts += metric.carts;
      return acc;
    },
    {
      sales: 0,
      views: 0,
      clicks: 0,
      impressions: 0,
      carts: 0,
    }
  );

  const purchasePrior = totals.views > 0 ? totals.sales / totals.views : 0;
  const cartPrior = totals.views > 0 ? totals.carts / totals.views : 0;
  const clickPrior = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

  const purchaseRates = metrics.map((metric) =>
    smoothedRate(metric.sales, metric.views, purchasePrior, 100)
  );

  const cartRates = metrics.map((metric) => smoothedRate(metric.carts, metric.views, cartPrior, 100));

  const clickRates = metrics.map((metric) =>
    smoothedRate(metric.clicks, metric.impressions, clickPrior, 500)
  );

  const salesP95 = percentile95(metrics.map((metric) => metric.sales));
  const viewsP95 = percentile95(metrics.map((metric) => metric.views));
  const purchaseRateP95 = percentile95(purchaseRates);
  const cartRateP95 = percentile95(cartRates);
  const clickRateP95 = percentile95(clickRates);

  const totalReviews = metrics.reduce((sum, metric) => sum + metric.reviewCount, 0);

  const averageRating =
    totalReviews > 0
      ? metrics.reduce((sum, metric) => sum + metric.rating * metric.reviewCount, 0) / totalReviews
      : 4;

  const ranked = metrics.map((metric, index) => {
    const purchaseRate = purchaseRates[index];
    const cartRate = cartRates[index];
    const clickRate = clickRates[index];

    const bayesianRating = (metric.rating * metric.reviewCount + averageRating * 10) / (metric.reviewCount + 10);

    const ratingScore = metric.rating > 0 ? clamp01((bayesianRating - 1) / 4) : 0;

    const freshnessScore =
      metric.daysSinceActivated == null ? 0 : Math.exp(-Math.max(metric.daysSinceActivated, 0) / 60);

    const bggScore =
      metric.bggRank != null && metric.bggRank > 0
        ? clamp01(1 - Math.log(metric.bggRank) / Math.log(10_000))
        : 0;

    const score =
      normalizeLog(metric.sales, salesP95) * 0.32 +
      normalizeLog(purchaseRate, purchaseRateP95) * 0.20 +
      normalizeLog(cartRate, cartRateP95) * 0.14 +
      normalizeLog(clickRate, clickRateP95) * 0.08 +
      ratingScore * 0.10 +
      normalizeLog(metric.views, viewsP95) * 0.05 +
      freshnessScore * 0.07 +
      bggScore * 0.04;

    return {
      ...metric,
      score,
    };
  });

  const ordered = ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.sales - a.sales ||
      b.reviewCount - a.reviewCount ||
      a.originalIndex - b.originalIndex
  );

  return new Map(ordered.map((entry) => [entry.item.id, entry.score]));
}

export function sortByRelevance<T extends VariantRelevanceInput>(items: T[]): T[] {
  if (items.length <= 1) {
    return [...items];
  }

  const scores = scoreByRelevance(items);

  return items
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      score: scores.get(item.id) ?? 0,
      sales: Math.max(item.unitsSoldInWindow ?? 0, 0),
      reviewCount: Math.max(item.reviewCount ?? 0, 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.sales - a.sales ||
        b.reviewCount - a.reviewCount ||
        a.originalIndex - b.originalIndex
    )
    .map((entry) => entry.item);
}