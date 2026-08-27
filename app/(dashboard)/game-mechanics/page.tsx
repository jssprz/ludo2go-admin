import { prisma } from '@jssprz/ludo2go-database';
import { GameMechanicsTable } from './game-mechanics-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Mecánicas de Juegos',
  description: 'Manage game mechanics',
};

export default async function GameMechanicsPage() {
  const t = await getTranslations('gameMechanics');

  const [mechanics, games, expansions] = await Promise.all([
    prisma.gameMechanic.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { games: true, expansions: true },
        },
        games: {
          select: {
            productId: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        expansions: {
          select: {
            productId: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.gameDetails.findMany({
      orderBy: {
        product: {
          name: 'asc',
        },
      },
      select: {
        productId: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.gameExpansionDetails.findMany({
      orderBy: {
        product: {
          name: 'asc',
        },
      },
      select: {
        productId: true,
        product: {
          select: {
            name: true,
          },
        },
      },
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

      <GameMechanicsTable
        initialMechanics={mechanics as any}
        availableGames={games.map((game) => ({ id: game.productId, name: game.product.name }))}
        availableExpansions={expansions.map((expansion) => ({
          id: expansion.productId,
          name: expansion.product.name,
        }))}
      />
    </div>
  );
}
