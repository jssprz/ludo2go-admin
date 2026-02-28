import { prisma } from '@jssprz/ludo2go-database';
import { GameCategoriesTable } from './game-categories-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Game Categories | Admin Dashboard',
  description: 'Manage game categories',
};

export default async function GameCategoriesPage() {
  const t = await getTranslations('gameCategories');
  
  const [categories, mediaAssets] = await Promise.all([
    prisma.gameCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        media: true,
        _count: {
          select: { games: true },
        },
      },
    }),
    prisma.mediaAsset.findMany({
      where: { kind: 'image' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

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

      <GameCategoriesTable initialCategories={categories as any} mediaAssets={mediaAssets} />
    </div>
  );
}
