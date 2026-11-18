import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { VariantEditForm } from './variant-edit-form';
import { VariantMediaEditor } from './variant-media-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';


type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditVariantPage({ params }: PageProps) {
  const t = await getTranslations('variantEditPage');
  const { id } = await params;

  const [variant, stores, locations, purchaseOrders] = await Promise.all([
    prisma.productVariant.findUnique({
      where: { id: id },
      include: {
        product: true,
        prices: {
          orderBy: [{ amount: 'desc' }]
        },
        externalPrices: {
          orderBy: [{ observedAt: 'desc' }]
        },
        inventory: {
          include: {
            location: true
          }
        }
      },
    }),
    prisma.store.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['submitted', 'confirmed', 'partially_received'] },
        items: { some: { variantId: id } },
      },
      include: {
        supplier: { select: { name: true } },
        items: {
          where: { variantId: id },
          select: {
            id: true,
            quantity: true,
            quantityReceived: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!variant) {
    notFound();
  }

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
  const pendingReceipts = purchaseOrders.flatMap((order) =>
    order.items
      .filter((item) => item.quantityReceived < item.quantity)
      .map((item) => ({
        purchaseOrderId: order.id,
        orderCode: order.code,
        supplierName: order.supplier.name,
        itemId: item.id,
        quantity: item.quantity,
        quantityReceived: item.quantityReceived,
      }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/products/${variant.product.id}/edit`}>{variant.product.name}</Link> · {variant.sku}
          </p>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
          <TabsTrigger value="media">{t('tabs.media')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <VariantEditForm 
            variant={variant} 
            storeLinks={storeLinks} 
            locations={locations}
            pendingReceipts={pendingReceipts}
          />
        </TabsContent>

        <TabsContent value="media">
          <VariantMediaEditor variantId={variant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}