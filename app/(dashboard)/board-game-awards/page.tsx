import { prisma } from '@jssprz/ludo2go-database';
import { BoardGameAwardsManager } from './board-game-awards-manager';

export const metadata = {
  title: 'Board Game Awards',
  description: 'Manage board game awards, organizations, and definitions',
};

export default async function BoardGameAwardsPage() {
  const [organizations, definitions, prizes] = await Promise.all([
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
      />
    </div>
  );
}
