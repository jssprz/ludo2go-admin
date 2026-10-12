export type InventoryPriority = 'order_now' | 'order_soon' | 'healthy' | 'do_not_reorder';

export type InventoryRecommendationInput = {
  weeklySales: number[];
  available: number;
  incoming: number;
  leadTimeDays: number;
  minimumOrderQuantity: number;
  packSize?: number;
};

export type InventoryRecommendation = {
  priority: InventoryPriority;
  salesPerWeek: number;
  daysOfCover: number | null;
  reorderPoint: number;
  suggestedQuantity: number;
  safetyStock: number;
  targetStock: number;
};

export function calculateInventoryRecommendation({
  weeklySales,
  available,
  incoming,
  leadTimeDays,
  minimumOrderQuantity,
  packSize = 1,
}: InventoryRecommendationInput): InventoryRecommendation {
  const weeks = Math.max(weeklySales.length, 1);
  const salesPerWeek = weeklySales.reduce((sum, quantity) => sum + quantity, 0) / weeks;
  const mean = salesPerWeek;
  const variance = weeklySales.reduce((sum, quantity) => sum + (quantity - mean) ** 2, 0) / weeks;
  const leadDays = Math.max(0, leadTimeDays);
  const leadWeeks = leadDays / 7;
  const safetyStock = Math.ceil(1.65 * Math.sqrt(variance) * Math.sqrt(leadWeeks));
  const demandDuringLeadTime = (salesPerWeek / 7) * leadDays;
  const reorderPoint = Math.ceil(demandDuringLeadTime + safetyStock);
  const targetStock = Math.ceil(reorderPoint + salesPerWeek * 2);
  const projectedAvailable = Math.max(0, available) + Math.max(0, incoming);
  const daysOfCover = salesPerWeek > 0
    ? (Math.max(0, available) / salesPerWeek) * 7
    : null;

  let priority: InventoryPriority;
  let suggestedQuantity = 0;

  if (salesPerWeek <= 0) {
    priority = 'do_not_reorder';
  } else {
    if (projectedAvailable <= reorderPoint) {
      priority = 'order_now';
    } else if (projectedAvailable <= reorderPoint + salesPerWeek) {
      priority = 'order_soon';
    } else {
      priority = 'healthy';
    }

    if (projectedAvailable < targetStock) {
      const pack = Math.max(1, Math.floor(packSize));
      const minimum = Math.max(0, Math.floor(minimumOrderQuantity));
      const quantityNeeded = targetStock - projectedAvailable;
      const quantityBeforePack = Math.max(quantityNeeded, minimum);
      suggestedQuantity = Math.ceil(quantityBeforePack / pack) * pack;
    }
  }

  return {
    priority,
    salesPerWeek,
    daysOfCover,
    reorderPoint,
    suggestedQuantity,
    safetyStock,
    targetStock,
  };
}