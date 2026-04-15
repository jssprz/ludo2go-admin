import { prisma } from '@jssprz/ludo2go-database';
import { NewProductForm } from './new-product-form';

export default async function NewProductPage() {
  const [brands, timelines, gameCategories, accessoryCategories, gameThemes, gameMechanics, gameComplexities, baseGames] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.gameTimeline.findMany({
      include: {
        events: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 1,
        },
      },
    }),
    prisma.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.accessoryCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.gameTheme.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.gameMechanic.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.gameComplexity.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    // Fetch all game products that have gameDetails (to use as base games for expansions)
    prisma.product.findMany({
      where: { kind: 'game', game: { isNot: null } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        game: { select: { productId: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            New product
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a new product. You can optionally prefill fields from BoardGameGeek.
          </p>
        </div>
      </div>

      <NewProductForm
        brands={brands}
        timelines={timelines}
        gameCategories={gameCategories}
        accessoryCategories={accessoryCategories}
        gameThemes={gameThemes}
        gameMechanics={gameMechanics}
        gameComplexities={gameComplexities}
        baseGames={baseGames.map(g => ({ id: g.game!.productId, name: g.name, slug: g.slug }))}
      />
    </div>
  );
}