import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { VariantEditForm } from './variant-edit-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditVariantPage({ params }: PageProps) {
  const { id } = await params;

  const variant = await prisma.productVariant.findUnique({
    where: { id: id },
    include: {
      product: true,
      externalPrices: {
        orderBy: [{ observedAt: 'desc' }]
      }
    },
  });

  if (!variant) {
    notFound();
  }

  const stores = await prisma.store.findMany({
    orderBy: { name: 'asc' },
  });

  const storeLinks = stores.map((store) => {
    const existing = variant.externalPrices.find(
      (p) => p.storeId === store.id
    );
    return {
      storeId: store.id,
      storeName: store.name,
      storeBaseUrl: store.url,
      existingPath: existing?.urlPathInStore ?? '',
      observedPrice: existing?.observedPrice ?? null,
      observedAt: existing?.observedAt
        ? existing.observedAt.toISOString()
        : null,
      currency: existing?.currency ?? 'CLP',
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit variant
          </h1>
          <p className="text-sm text-muted-foreground">
            {variant.product.name} · {variant.sku}
          </p>
        </div>
      </div>

      <VariantEditForm variant={variant} storeLinks={storeLinks} />
    </div>
  );
}