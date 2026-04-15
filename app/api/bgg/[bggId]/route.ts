import { NextResponse } from 'next/server';
import { bgg } from '@/lib/bgg/client';
import { prisma } from '@jssprz/ludo2go-database';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bggId: string }> }
) {
  const { bggId } = await params;

  if (!bggId) {
    return NextResponse.json(
      { message: 'Missing bggId' },
      { status: 400 }
    );
  }

  try {
    const things = await bgg.thing(bggId, { stats: true });
    const thing = things[0];

    if (!thing) {
      return NextResponse.json(
        { message: 'Game not found in BGG' },
        { status: 404 }
      );
    }

    // Extract mechanic BGG IDs from the links
    const mechanicLinks = (thing.links ?? []).filter(l => l.type === 'boardgamemechanic');
    const mechanicBggIds = mechanicLinks.map(l => l.id);

    // Look up which of those BGG mechanic IDs exist in our GameMechanic table
    let matchedMechanics: Array<{ id: string; name: string; slug: string; bggId: number | null }> = [];
    if (mechanicBggIds.length > 0) {
      matchedMechanics = await prisma.gameMechanic.findMany({
        where: { bggId: { in: mechanicBggIds } },
        select: { id: true, name: true, slug: true, bggId: true },
      });
    }

    const response = {
      id: Number(thing.id),
      name: thing.name,
      description: thing.description || undefined,
      yearPublished: thing.yearPublished,
      minPlayers: thing.minPlayers,
      maxPlayers: thing.maxPlayers,
      playingTime: thing.playingTime,
      minPlayTime: thing.minPlayTime,
      maxPlayTime: thing.maxPlayTime,
      minAge: thing.minAge,
      image: thing.image,
      thumbnail: thing.thumbnail,
      // All raw BGG links (for storing in BGGDetails.links)
      links: thing.links ?? [],
      // Convenience: mechanic names from BGG
      mechanics: thing.mechanics ?? [],
      // Matched mechanics from our DB (id + name for auto-selecting in the form)
      matchedMechanics,
      // Unmatched mechanic names (BGG mechanics we don't have in our DB)
      unmatchedMechanics: mechanicLinks
        .filter(l => !matchedMechanics.some(m => m.bggId === l.id))
        .map(l => ({ bggId: l.id, name: l.value })),
      avgRating: thing.stats?.average,
      bayesAverageRating: thing.stats?.bayesAverage,
      averageWeightRating: thing.stats?.averageWeight,
      // All parsed ranks from BGG (boardgame rank, subcategory ranks, etc.)
      ranks: thing.stats?.ranks ?? [],
      // Extract the overall boardgame rank value for convenience
      boardgameRank: (() => {
        const bgRank = (thing.stats?.ranks ?? []).find(r => r.name === 'boardgame');
        return bgRank && bgRank.value !== 'Not Ranked' ? Number(bgRank.value) : null;
      })(),
      categories: thing.categories ?? [],
      designers: thing.designers ?? [],
      publishers: thing.publishers ?? [],
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error fetching BGG', err);
    return NextResponse.json(
      { message: 'Error fetching BGG data' },
      { status: 500 }
    );
  }
}