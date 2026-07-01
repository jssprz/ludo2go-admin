import { prisma } from '@jssprz/ludo2go-database';
import { VariantPricesTable } from './prices-table';

export default async function VariantPricesPage() {
  const variants = await prisma.productVariant.findMany({
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      prices: {
        where: {
          active: true,
          type: { in: ['retail', 'sale'] },
        },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
  });

  const variantIds = variants.map((variant) => variant.id);

  const externalPriceRows = variantIds.length
    ? await prisma.itemPriceInStore.findMany({
        where: {
          variantId: { in: variantIds },
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ observedAt: 'desc' }],
      })
    : [];

  const seenVariantStoreKeys: Record<string, true> = {};
  const externalPricesByVariant: Record<
    string,
    Array<{
      storeId: string;
      storeName: string;
      observedPrice: number;
      currency: string;
      observedAt: string;
    }>
  > = {};

  externalPriceRows.forEach((row) => {
    const key = `${row.variantId}:${row.storeId}`;
    if (seenVariantStoreKeys[key]) return;
    seenVariantStoreKeys[key] = true;
    if (row.observedPrice == null) return;

    const current = externalPricesByVariant[row.variantId] ?? [];
    current.push({
      storeId: row.storeId,
      storeName: row.store.name,
      observedPrice: row.observedPrice,
      currency: row.currency,
      observedAt: row.observedAt.toISOString(),
    });
    externalPricesByVariant[row.variantId] = current;
  });

  const rows = variants.map((variant) => {
    const retailPrice = variant.prices.find((price) => price.type === 'retail');
    const salePrice = variant.prices.find((price) => price.type === 'sale');

    return {
      id: variant.id,
      sku: variant.sku,
      product: variant.product,
      retailPriceId: retailPrice?.id ?? null,
      salePriceId: salePrice?.id ?? null,
      retailAmount: retailPrice?.amount ?? null,
      saleAmount: salePrice?.amount ?? null,
      currency: retailPrice?.currency ?? salePrice?.currency ?? 'CLP',
      externalPrices: externalPricesByVariant[variant.id] ?? [],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Variant Price Management</h1>
          <p className="text-muted-foreground">
            Manage retail and sale prices, and monitor discount performance for all variants.
          </p>
        </div>
      </div>

      <VariantPricesTable variants={rows} />
    </div>
  );
}
