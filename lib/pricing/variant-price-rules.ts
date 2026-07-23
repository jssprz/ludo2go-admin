import { prisma } from '@jssprz/ludo2go-database';
import {
  Prisma,
  PriceCurrency,
  PriceType,
  ProductKind,
  ProductStatus,
  VariantPriceRule,
  VariantPriceRuleComputationType,
  VariantStatus,
} from '@prisma/client';

import {
  buildCreateAuditFields,
  buildUpdateAuditFields,
} from '@/lib/admin-audit';

type RuleArrayField = string[] | null | undefined;

export type VariantPriceRulePayload = {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  currency?: unknown;
  taxIncluded?: unknown;
  channelId?: unknown;
  priceBookId?: unknown;
  region?: unknown;
  sourcePriceType?: unknown;
  computationType?: unknown;
  fixedAmount?: unknown;
  percentageDiscount?: unknown;
  fixedDiscountAmount?: unknown;
  minResultAmount?: unknown;
  productKind?: unknown;
  productStatus?: unknown;
  variantStatus?: unknown;
  requireStock?: unknown;
  requiredStockLocationIds?: unknown;
  allowedProductIds?: unknown;
  excludedProductIds?: unknown;
  allowedVariantIds?: unknown;
  excludedVariantIds?: unknown;
  allowedVariantSKUs?: unknown;
  excludedVariantSKUs?: unknown;
  allowedGameCategoryIds?: unknown;
  excludedGameCategoryIds?: unknown;
  allowedGameThemeIds?: unknown;
  excludedGameThemeIds?: unknown;
  allowedGameMechanicIds?: unknown;
  excludedGameMechanicIds?: unknown;
  allowedTags?: unknown;
  excludedTags?: unknown;
  metadata?: unknown;
};

function asStringArray(input: RuleArrayField): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asOptionalString(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return value ? value : null;
}

function asOptionalDate(input: unknown): Date | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string') return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function asOptionalInt(input: unknown): number | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  if (input < 0) return null;
  return Math.round(input);
}

function asBoolean(input: unknown, fallback = false): boolean {
  if (typeof input === 'boolean') return input;
  return fallback;
}

function decimalValue(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value.toFixed(2);
}

function assertComputationConfig(
  computationType: VariantPriceRuleComputationType,
  fixedAmount: number | null,
  percentageDiscount: string | null,
  fixedDiscountAmount: number | null
) {
  if (computationType === 'set_fixed_amount' && fixedAmount == null) {
    throw new Error('fixedAmount is required for set_fixed_amount rules');
  }

  if (computationType === 'percentage_discount' && percentageDiscount == null) {
    throw new Error('percentageDiscount is required for percentage_discount rules');
  }

  if (computationType === 'fixed_discount' && fixedDiscountAmount == null) {
    throw new Error('fixedDiscountAmount is required for fixed_discount rules');
  }
}

export function buildVariantPriceRuleData(payload: VariantPriceRulePayload) {
  const name = asOptionalString(payload.name);
  if (!name) {
    throw new Error('Rule name is required');
  }

  const startsAt = asOptionalDate(payload.startsAt);
  const endsAt = asOptionalDate(payload.endsAt);
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error('startsAt cannot be greater than endsAt');
  }

  const sourcePriceType = (payload.sourcePriceType as PriceType | undefined) ?? 'retail';
  const computationType =
    (payload.computationType as VariantPriceRuleComputationType | undefined) ??
    'percentage_discount';

  const fixedAmount = asOptionalInt(payload.fixedAmount);
  const percentageDiscount = decimalValue(payload.percentageDiscount);
  const fixedDiscountAmount = asOptionalInt(payload.fixedDiscountAmount);
  const minResultAmount = asOptionalInt(payload.minResultAmount);

  assertComputationConfig(computationType, fixedAmount, percentageDiscount, fixedDiscountAmount);

  const rawCurrency = payload.currency as PriceCurrency | undefined;
  const currency: PriceCurrency =
    rawCurrency === 'CLP' || rawCurrency === 'USD' || rawCurrency === 'EUR'
      ? rawCurrency
      : 'CLP';

  const metadata =
    payload.metadata === undefined
      ? undefined
      : payload.metadata === null
        ? Prisma.JsonNull
        : (payload.metadata as Prisma.InputJsonValue);

  return {
    name,
    description: asOptionalString(payload.description),
    active: asBoolean(payload.active, true),
    startsAt,
    endsAt,
    currency,
    taxIncluded: typeof payload.taxIncluded === 'boolean' ? payload.taxIncluded : null,
    channelId: asOptionalString(payload.channelId),
    priceBookId: asOptionalString(payload.priceBookId),
    region: asOptionalString(payload.region),
    sourcePriceType,
    computationType,
    fixedAmount,
    percentageDiscount,
    fixedDiscountAmount,
    minResultAmount,
    productKind: (payload.productKind as ProductKind | undefined) ?? null,
    productStatus: (payload.productStatus as ProductStatus | undefined) ?? null,
    variantStatus: (payload.variantStatus as VariantStatus | undefined) ?? null,
    requireStock: asBoolean(payload.requireStock, false),
    requiredStockLocationIds: asStringArray(payload.requiredStockLocationIds as RuleArrayField),
    allowedProductIds: asStringArray(payload.allowedProductIds as RuleArrayField),
    excludedProductIds: asStringArray(payload.excludedProductIds as RuleArrayField),
    allowedVariantIds: asStringArray(payload.allowedVariantIds as RuleArrayField),
    excludedVariantIds: asStringArray(payload.excludedVariantIds as RuleArrayField),
    allowedVariantSKUs: asStringArray(payload.allowedVariantSKUs as RuleArrayField),
    excludedVariantSKUs: asStringArray(payload.excludedVariantSKUs as RuleArrayField),
    allowedGameCategoryIds: asStringArray(payload.allowedGameCategoryIds as RuleArrayField),
    excludedGameCategoryIds: asStringArray(payload.excludedGameCategoryIds as RuleArrayField),
    allowedGameThemeIds: asStringArray(payload.allowedGameThemeIds as RuleArrayField),
    excludedGameThemeIds: asStringArray(payload.excludedGameThemeIds as RuleArrayField),
    allowedGameMechanicIds: asStringArray(payload.allowedGameMechanicIds as RuleArrayField),
    excludedGameMechanicIds: asStringArray(payload.excludedGameMechanicIds as RuleArrayField),
    allowedTags: asStringArray(payload.allowedTags as RuleArrayField),
    excludedTags: asStringArray(payload.excludedTags as RuleArrayField),
    metadata,
  };
}

function includesAny(values: string[], targetValues: string[]) {
  if (values.length === 0) return true;
  const targetSet = new Set(targetValues);
  return values.some((value) => targetSet.has(value));
}

function hasExcluded(values: string[], targetValues: string[]) {
  if (values.length === 0) return false;
  const targetSet = new Set(targetValues);
  return values.some((value) => targetSet.has(value));
}

function computeRuleAmount(rule: VariantPriceRule, sourceAmount: number | null): number | null {
  if (rule.computationType === 'set_fixed_amount') {
    if (rule.fixedAmount == null) return null;
    return rule.fixedAmount;
  }

  if (sourceAmount == null) return null;

  if (rule.computationType === 'percentage_discount') {
    const discount = Number(rule.percentageDiscount ?? 0);
    const discounted = Math.round(sourceAmount * (1 - discount / 100));
    return discounted;
  }

  if (rule.computationType === 'fixed_discount') {
    if (rule.fixedDiscountAmount == null) return null;
    return sourceAmount - rule.fixedDiscountAmount;
  }

  return null;
}

async function findImpactedVariantIds(rule: VariantPriceRule): Promise<string[]> {
  const productWhere: { kind?: ProductKind; status?: ProductStatus } = {};
  if (rule.productKind) {
    productWhere.kind = rule.productKind;
  }
  if (rule.productStatus) {
    productWhere.status = rule.productStatus;
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      ...(Object.keys(productWhere).length > 0 ? { product: productWhere } : {}),
      ...(rule.variantStatus ? { status: rule.variantStatus } : {}),
    },
    select: {
      id: true,
      sku: true,
      inventory: {
        select: {
          onHand: true,
          reserved: true,
          locationId: true,
        },
      },
      product: {
        select: {
          id: true,
          tags: true,
          game: {
            select: {
              categories: { select: { id: true } },
              themes: { select: { id: true } },
              mechanics: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  return variants
    .filter((variant) => {
      if (rule.allowedProductIds.length > 0 && !rule.allowedProductIds.includes(variant.product.id)) {
        return false;
      }
      if (rule.excludedProductIds.includes(variant.product.id)) {
        return false;
      }

      if (rule.allowedVariantIds.length > 0 && !rule.allowedVariantIds.includes(variant.id)) {
        return false;
      }
      if (rule.excludedVariantIds.includes(variant.id)) {
        return false;
      }

      if (rule.allowedVariantSKUs.length > 0 && !rule.allowedVariantSKUs.includes(variant.sku)) {
        return false;
      }
      if (rule.excludedVariantSKUs.includes(variant.sku)) {
        return false;
      }

      if (rule.allowedTags.length > 0 && !includesAny(rule.allowedTags, variant.product.tags)) {
        return false;
      }
      if (hasExcluded(rule.excludedTags, variant.product.tags)) {
        return false;
      }

      const categoryIds = variant.product.game?.categories.map((c) => c.id) ?? [];
      const themeIds = variant.product.game?.themes.map((t) => t.id) ?? [];
      const mechanicIds = variant.product.game?.mechanics.map((m) => m.id) ?? [];

      if (!includesAny(rule.allowedGameCategoryIds, categoryIds)) {
        return false;
      }
      if (hasExcluded(rule.excludedGameCategoryIds, categoryIds)) {
        return false;
      }

      if (!includesAny(rule.allowedGameThemeIds, themeIds)) {
        return false;
      }
      if (hasExcluded(rule.excludedGameThemeIds, themeIds)) {
        return false;
      }

      if (!includesAny(rule.allowedGameMechanicIds, mechanicIds)) {
        return false;
      }
      if (hasExcluded(rule.excludedGameMechanicIds, mechanicIds)) {
        return false;
      }

      if (rule.requireStock) {
        const inventories =
          rule.requiredStockLocationIds.length > 0
            ? variant.inventory.filter((inventory) =>
                rule.requiredStockLocationIds.includes(inventory.locationId)
              )
            : variant.inventory;

        const hasStock = inventories.some((inventory) => inventory.onHand - inventory.reserved > 0);
        if (!hasStock) {
          return false;
        }
      }

      return true;
    })
    .map((variant) => variant.id);
}

export async function applyVariantPriceRule(ruleId: string, adminUserId: string | null) {
  const rule = await prisma.variantPriceRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    throw new Error('Price rule not found');
  }

  const impactedVariantIds = await findImpactedVariantIds(rule);

  const sourcePrices = rule.computationType === 'set_fixed_amount'
    ? []
    : await prisma.price.findMany({
        where: {
          variantId: { in: impactedVariantIds },
          type: rule.sourcePriceType,
          currency: rule.currency,
          active: true,
          ...(rule.channelId ? { channelId: rule.channelId } : {}),
          ...(rule.priceBookId ? { priceBookId: rule.priceBookId } : {}),
          ...(rule.region ? { region: rule.region } : {}),
        },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      });

  const sourceByVariant = new Map<string, number>();
  sourcePrices.forEach((price) => {
    if (!sourceByVariant.has(price.variantId)) {
      sourceByVariant.set(price.variantId, price.amount);
    }
  });

  const createRows = impactedVariantIds
    .map((variantId) => {
      const sourceAmount = sourceByVariant.get(variantId) ?? null;
      const computedAmount = computeRuleAmount(rule, sourceAmount);
      if (computedAmount == null) return null;

      const boundedAmount =
        rule.minResultAmount != null
          ? Math.max(rule.minResultAmount, computedAmount)
          : computedAmount;

      const roundedToClosestEndingZero = Math.round(boundedAmount / 10) * 10;
      const finalAmount = Math.max(0, roundedToClosestEndingZero);

      return {
        variantId,
        currency: rule.currency,
        type: 'rule_based' as PriceType,
        amount: finalAmount,
        taxIncluded: rule.taxIncluded,
        priceBookId: rule.priceBookId,
        channelId: rule.channelId,
        sourceRuleId: rule.id,
        region: rule.region,
        startsAt: rule.startsAt,
        endsAt: rule.endsAt,
        active: rule.active,
        ...buildCreateAuditFields(adminUserId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  await prisma.$transaction(async (tx) => {
    await tx.price.deleteMany({ where: { sourceRuleId: rule.id } });

    if (createRows.length > 0) {
      await tx.price.createMany({ data: createRows });
    }

    await tx.variantPriceRule.update({
      where: { id: rule.id },
      data: {
        applied: true,
        ...buildUpdateAuditFields(adminUserId),
      },
    });
  });

  return {
    impactedVariants: impactedVariantIds.length,
    createdPrices: createRows.length,
  };
}

export async function unapplyVariantPriceRule(ruleId: string, adminUserId: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.price.deleteMany({ where: { sourceRuleId: ruleId } });
    await tx.variantPriceRule.update({
      where: { id: ruleId },
      data: {
        applied: false,
        ...buildUpdateAuditFields(adminUserId),
      },
    });

    return deleted.count;
  });

  return { deletedPrices: result };
}
