import { prisma } from '@jssprz/ludo2go-database';
import { GameThemesTable } from './game-themes-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Game Themes | Admin Dashboard',
  description: 'Manage game themes',
};

export default async function GameThemesPage() {
  const t = await getTranslations('gameThemes');

  const themes = await prisma.gameTheme.findMany({
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

      <GameThemesTable initialThemes={themes as any} />
    </div>
  );
}
