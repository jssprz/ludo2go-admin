import { prisma } from '@jssprz/ludo2go-database';
import { GameComplexitiesTable } from './game-complexities-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Game Complexities | Admin Dashboard',
  description: 'Manage game complexities',
};

export default async function GameComplexitiesPage() {
  const t = await getTranslations('gameComplexities');

  const complexities = await prisma.gameComplexity.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: {
        select: { games: true },
      },
    },
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

      <GameComplexitiesTable initialComplexities={complexities as any} />
    </div>
  );
}
