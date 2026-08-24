import { prisma } from '@jssprz/ludo2go-database';
import { BrandsTable } from './brands-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Marcas',
  description: 'Manage product brands',
};

export default async function BrandsPage() {
  const t = await getTranslations('brands');
  
  const [rawBrands, mediaAssets] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        logoMedia: true,
        products: {
          select: {
            bgg: {
              select: {
                boardgameRank: true,
              },
            },
          },
        },
        _count: {
          select: { products: true },
        },
      },
    }),
    prisma.mediaAsset.findMany({
      where: { kind: 'image' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const brands = rawBrands.map((brand) => {
    const rankedItems = brand.products
      .map((product) => product.bgg?.boardgameRank)
      .filter((rank): rank is number => typeof rank === 'number');

    const avgBggRank = rankedItems.length
      ? rankedItems.reduce((sum, rank) => sum + rank, 0) / rankedItems.length
      : null;

    return {
      ...brand,
      avgBggRank,
      bggRankedProductsCount: rankedItems.length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <BrandsTable initialBrands={brands as any} mediaAssets={mediaAssets} />
    </div>
  );
}
