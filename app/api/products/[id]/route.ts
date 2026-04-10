import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET single product
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        game: true,
        accessory: true,
        expansion: true,
        bundle: true,
        bgg: true,
        variants: true,
      },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT update product
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      brandId,
      kind,
      status,
      tags,
      shortDescription,
      description,
      complexityId,
      timelineId,
      gameCategoryIds,
      gameThemeIds,
      gameMechanicIds,
      accessoryCategoryIds,
      // Game / Expansion shared fields
      yearPublished,
      minPlayers,
      maxPlayers,
      minAge,
      playtimeMin,
      playtimeMax,
      // Expansion-specific fields
      baseGameId,
      addedComponents,
      isStandalone,
      isMajor,
      editionNumber,
      // BGG data
      bgg,
    } = body;

    const { id } = await params;

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        slug,
        brandId: brandId || null,
        kind,
        status,
        tags,
        shortDescription,
        description,
      },
      include: {
        game: true,
        accessory: true,
        expansion: true,
      },
    });

    // If it's a game product, update the timeline and categories
    if (kind === 'game' && product.game) {
      await prisma.gameDetails.update({
        where: { productId: id },
        data: {
          timelineId: timelineId || null,
          complexityId: complexityId || null,
          categories: {
            set: (gameCategoryIds || []).map((catId: string) => ({ id: catId })),
          },
          themes: {
            set: (gameThemeIds || []).map((themeId: string) => ({ id: themeId })),
          },
          mechanics: {
            set: (gameMechanicIds || []).map((mechanicId: string) => ({ id: mechanicId })),
          },
          yearPublished: typeof yearPublished === 'number' ? yearPublished : null,
          minPlayers: typeof minPlayers === 'number' ? minPlayers : null,
          maxPlayers: typeof maxPlayers === 'number' ? maxPlayers : null,
          minAge: typeof minAge === 'number' ? minAge : null,
          playtimeMin: typeof playtimeMin === 'number' ? playtimeMin : null,
          playtimeMax: typeof playtimeMax === 'number' ? playtimeMax : null,
        },
      });
    }

    // If it's an accessory product, update categories
    if (kind === 'accessory' && product.accessory) {
      await prisma.accessoryDetails.update({
        where: { productId: id },
        data: {
          categories: {
            set: (accessoryCategoryIds || []).map((catId: string) => ({ id: catId })),
          },
        },
      });
    }

    // If it's an expansion product, upsert expansion details
    if (kind === 'expansion') {
      const expansionData = {
        baseGameId: baseGameId || product.expansion?.baseGameId,
        timelineId: timelineId || null,
        complexityId: complexityId || null,
        yearPublished: typeof yearPublished === 'number' ? yearPublished : null,
        minPlayers: typeof minPlayers === 'number' ? minPlayers : null,
        maxPlayers: typeof maxPlayers === 'number' ? maxPlayers : null,
        minAge: typeof minAge === 'number' ? minAge : null,
        playtimeMin: typeof playtimeMin === 'number' ? playtimeMin : null,
        playtimeMax: typeof playtimeMax === 'number' ? playtimeMax : null,
        addedComponents: addedComponents || null,
        isStandalone: isStandalone ?? false,
        isMajor: isMajor ?? false,
        editionNumber: typeof editionNumber === 'number' ? editionNumber : null,
        categories: {
          set: (gameCategoryIds || []).map((catId: string) => ({ id: catId })),
        },
        themes: {
          set: (gameThemeIds || []).map((themeId: string) => ({ id: themeId })),
        },
        mechanics: {
          set: (gameMechanicIds || []).map((mechanicId: string) => ({ id: mechanicId })),
        },
      };

      if (product.expansion) {
        await prisma.gameExpansionDetails.update({
          where: { productId: id },
          data: expansionData,
        });
      } else if (baseGameId) {
        await prisma.gameExpansionDetails.create({
          data: {
            productId: id,
            baseGameId,
            timelineId: timelineId || null,
            complexityId: complexityId || null,
            yearPublished: typeof yearPublished === 'number' ? yearPublished : null,
            minPlayers: typeof minPlayers === 'number' ? minPlayers : null,
            maxPlayers: typeof maxPlayers === 'number' ? maxPlayers : null,
            minAge: typeof minAge === 'number' ? minAge : null,
            playtimeMin: typeof playtimeMin === 'number' ? playtimeMin : null,
            playtimeMax: typeof playtimeMax === 'number' ? playtimeMax : null,
            addedComponents: addedComponents || null,
            isStandalone: isStandalone ?? false,
            isMajor: isMajor ?? false,
            editionNumber: typeof editionNumber === 'number' ? editionNumber : null,
            ...(gameCategoryIds?.length
              ? { categories: { connect: gameCategoryIds.map((cId: string) => ({ id: cId })) } }
              : {}),
            ...(gameThemeIds?.length
              ? { themes: { connect: gameThemeIds.map((tId: string) => ({ id: tId })) } }
              : {}),
            ...(gameMechanicIds?.length
              ? { mechanics: { connect: gameMechanicIds.map((mId: string) => ({ id: mId })) } }
              : {}),
          },
        });
      }
    }

    // Upsert BGG details if provided
    if (bgg && bgg.bggId) {
      const existingBgg = await prisma.bGGDetails.findUnique({
        where: { productId: id },
      });

      if (existingBgg) {
        // Update existing BGG details
        await prisma.bGGDetails.update({
          where: { productId: id },
          data: {
            id: Number(bgg.bggId),
            avgRating: typeof bgg.avgRating === 'number' ? bgg.avgRating : null,
            bayesAverageRating: typeof bgg.bayesAverageRating === 'number' ? bgg.bayesAverageRating : null,
            averageWeightRating: typeof bgg.averageWeightRating === 'number' ? bgg.averageWeightRating : null,
            boardgameRank: typeof bgg.boardgameRank === 'number' ? bgg.boardgameRank : null,
          },
        });

        // Replace ranks if provided
        if (bgg.ranks && Array.isArray(bgg.ranks) && bgg.ranks.length > 0) {
          // Delete existing ranks
          await prisma.bGGRank.deleteMany({
            where: { bggDetailsId: existingBgg.productId },
          });
          // Create new ranks
          await prisma.bGGRank.createMany({
            data: bgg.ranks
              .filter((r: any) => r.value !== 'Not Ranked')
              .map((r: any) => ({
                bggDetailsId: existingBgg.productId,
                type: r.type,
                bggId: Number(r.id),
                name: r.name,
                friendlyName: r.friendlyName,
                value: typeof r.value === 'number' ? r.value : null,
                bayesAverage: typeof r.bayesAverage === 'number' ? r.bayesAverage : null,
              })),
          });
        }
      } else {
        // Create new BGG details
        const trackingEntry = await prisma.bGGDetailsTrakingTable.create({
          data: {
            apiURL: `https://boardgamegeek.com/xmlapi2/thing?id=${bgg.bggId}`,
          },
        });

        await prisma.bGGDetails.create({
          data: {
            productId: id,
            id: Number(bgg.bggId),
            sourceApiRequestId: trackingEntry.id,
            avgRating: typeof bgg.avgRating === 'number' ? bgg.avgRating : null,
            bayesAverageRating: typeof bgg.bayesAverageRating === 'number' ? bgg.bayesAverageRating : null,
            averageWeightRating: typeof bgg.averageWeightRating === 'number' ? bgg.averageWeightRating : null,
            boardgameRank: typeof bgg.boardgameRank === 'number' ? bgg.boardgameRank : null,
            ...(bgg.ranks && Array.isArray(bgg.ranks) && bgg.ranks.length > 0
              ? {
                ranks: {
                  create: bgg.ranks
                    .filter((r: any) => r.value !== 'Not Ranked')
                    .map((r: any) => ({
                      type: r.type,
                      bggId: Number(r.id),
                      name: r.name,
                      friendlyName: r.friendlyName,
                      value: typeof r.value === 'number' ? r.value : null,
                      bayesAverage: typeof r.bayesAverage === 'number' ? r.bayesAverage : null,
                    })),
                },
              }
              : {}),
          },
        });
      }
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE product
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}
