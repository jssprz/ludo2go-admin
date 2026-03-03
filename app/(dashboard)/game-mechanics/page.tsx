import { prisma } from '@jssprz/ludo2go-database';
import { GameMechanicsTable } from './game-mechanics-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Game Mechanics | Admin Dashboard',
  description: 'Manage game mechanics',
};

export default async function GameMechanicsPage() {
  const t = await getTranslations('gameMechanics');

  const mechanics = await prisma.gameMechanic.findMany({
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

      <GameMechanicsTable initialMechanics={mechanics as any} />
    </div>
  );
}
