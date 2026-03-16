import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { ProductEditForm } from './product-edit-form';
import { ProductMediaEditor } from './product-media-editor';
import { ProductVariantsEditor } from './product-variants-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PageProps = {
  params: Promise<{ id: string; }>;
};

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;

  const [product, timelines, brands, gameCategories, accessoryCategories, gameThemes, gameMechanics, gameComplexities] = await Promise.all([
    prisma.product.findUnique({
      where: { id: id },
      include: {
        game: {
          include: {
            categories: true,
            themes: true,
            mechanics: true,
          },
        },
        accessory: {
          include: {
            categories: true,
          },
        },
        bundle: true,
        bgg: true,
        variants: true,
        brand: true,
      },
    }),
    prisma.gameTimeline.findMany({
      include: {
        events: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 1,
        },
      },
    }),
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.accessoryCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.gameTheme.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.gameMechanic.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.gameComplexity.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    })
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit product: {product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update product information, media, and settings.
          </p>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <ProductEditForm
            product={product}
            timelines={timelines}
            brands={brands}
            gameCategories={gameCategories}
            accessoryCategories={accessoryCategories}
            gameThemes={gameThemes}
            gameMechanics={gameMechanics}
            gameComplexities={gameComplexities}
          />
        </TabsContent>

        <TabsContent value="media">
          <ProductMediaEditor productId={product.id} />
        </TabsContent>

        <TabsContent value="variants">
          <ProductVariantsEditor productId={product.id} productSlug={product.slug} variants={product.variants} />
        </TabsContent>
      </Tabs>
    </div>
  );
}