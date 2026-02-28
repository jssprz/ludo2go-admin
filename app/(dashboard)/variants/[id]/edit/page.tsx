import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { VariantEditForm } from './variant-edit-form';
import { VariantMediaEditor } from './variant-media-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditVariantPage({ params }: PageProps) {
  const { id } = await params;

  const [variant, stores, locations] = await Promise.all([
    prisma.productVariant.findUnique({
      where: { id: id },
      include: {
        product: true,
        prices: {
          orderBy: [{ amount: 'asc' }]
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

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <VariantEditForm 
            variant={variant} 
            storeLinks={storeLinks} 
            locations={locations}
          />
        </TabsContent>

        <TabsContent value="media">
          <VariantMediaEditor variantId={variant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}