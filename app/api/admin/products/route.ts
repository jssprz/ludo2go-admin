import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// POST /api/admin/products - Create a new product
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product: productData, game, accessory, bgg } = body;

    if (!productData?.name) {
      return NextResponse.json(
        { message: 'Product name is required' },
        { status: 400 }
      );
    }

    const slug = productData.slug || productData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug already exists
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      return NextResponse.json(
        { message: 'A product with this slug already exists' },
        { status: 400 }
      );
    }

    // Create the product
    const created = await prisma.product.create({
      data: {
        name: productData.name,
        slug,
        brandId: productData.brandId || null,
        kind: productData.kind || 'game',
        status: productData.status || 'draft',
        tags: productData.tags || [],
        shortDescription: productData.shortDescription || null,
        description: productData.description || null,
      },
    });

    // Create game details if it's a game product
    if (productData.kind === 'game' && game) {
      await prisma.gameDetails.create({
        data: {
          productId: created.id,
          yearPublished: typeof game.yearPublished === 'number' ? game.yearPublished : null,
          minPlayers: typeof game.minPlayers === 'number' ? game.minPlayers : null,
          maxPlayers: typeof game.maxPlayers === 'number' ? game.maxPlayers : null,
          minAge: typeof game.minAge === 'number' ? game.minAge : null,
          playtimeMin: typeof game.playtimeMin === 'number' ? game.playtimeMin : null,
          playtimeMax: typeof game.playtimeMax === 'number' ? game.playtimeMax : null,
          timelineId: game.timelineId || null,
          ...(game.gameCategoryIds?.length
            ? { categories: { connect: game.gameCategoryIds.map((id: string) => ({ id })) } }
            : {}),
          ...(game.gameThemeIds?.length
            ? { themes: { connect: game.gameThemeIds.map((id: string) => ({ id })) } }
            : {}),
          ...(game.gameMechanicIds?.length
            ? { mechanics: { connect: game.gameMechanicIds.map((id: string) => ({ id })) } }
            : {}),
        },
      });
    }

    // Create accessory details if it's an accessory product
    if (productData.kind === 'accessory' && accessory) {
      await prisma.accessoryDetails.create({
        data: {
          productId: created.id,
          tier: accessory.tier || 'básico',
          ...(accessory.accessoryCategoryIds?.length
            ? { categories: { connect: accessory.accessoryCategoryIds.map((id: string) => ({ id })) } }
            : {}),
        },
      });
    }

    // Create BGG tracking entry + details if BGG data provided
    if (bgg && bgg.bggId) {
      const trackingEntry = await prisma.bGGDetailsTrakingTable.create({
        data: {
          apiURL: `https://boardgamegeek.com/xmlapi2/thing?id=${bgg.bggId}`,
        },
      });

      await prisma.bGGDetails.create({
        data: {
          productId: created.id,
          id: Number(bgg.bggId),
          sourceApiRequestId: trackingEntry.id,
          avgRating: typeof bgg.avgRating === 'number' ? bgg.avgRating : null,
          bayesAverageRating: typeof bgg.bayesAverageRating === 'number' ? bgg.bayesAverageRating : null,
          averageWeightRating: typeof bgg.averageWeightRating === 'number' ? bgg.averageWeightRating : null,
        },
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
