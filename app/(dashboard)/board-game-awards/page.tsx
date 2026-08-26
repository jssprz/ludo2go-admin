import { prisma } from '@jssprz/ludo2go-database';
import { BoardGameAwardsManager } from './manager';

export const metadata = {
  title: 'Board Game Awards',
  description: 'Manage board game awards, organizations, and definitions',
};

export default async function BoardGameAwardsPage() {
  const [organizations, definitions, prizes, games, expansions] = await Promise.all([
    prisma.boardGamePrizeOrganization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            prizeDefinitions: true,
          },
        },
      },
    }),
    prisma.boardGamePrizeDefinition.findMany({
      orderBy: { name: 'asc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            prizes: true,
          },
        },
      },
    }),
    prisma.boardGamePrize.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        prizeDefinition: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            games: true,
            expansions: true,
            events: true,
          },
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Board Game Awards</h1>
        <p className="text-muted-foreground">
          Manage prize organizations, prize definitions, and award records for games and expansions.
        </p>
      </div>

      <BoardGameAwardsManager
        initialOrganizations={organizations}
        initialDefinitions={definitions}
        initialPrizes={prizes}
        availableGames={games.map((game) => ({ id: game.productId, name: game.product.name }))}
        availableExpansions={expansions.map((expansion) => ({
          id: expansion.productId,
          name: expansion.product.name,
        }))}
      />
    </div>
  );
}
