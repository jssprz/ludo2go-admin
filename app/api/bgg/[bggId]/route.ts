import { NextResponse } from 'next/server';
import { bgg } from '@/lib/bgg/client';
import { prisma } from '@jssprz/ludo2go-database';
import { translateText } from '@/lib/google-translation';

type MechanicSummary = {
  id: string;
  name: string;
  slug: string;
  bggId: number | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function buildUniqueMechanicSlug(baseName: string): Promise<string> {
  const baseSlug = slugify(baseName) || `mechanic-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const exists = await prisma.gameMechanic.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

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
    let matchedMechanics: MechanicSummary[] = [];
    if (mechanicBggIds.length > 0) {
      matchedMechanics = await prisma.gameMechanic.findMany({
        where: { bggId: { in: mechanicBggIds } },
        select: { id: true, name: true, slug: true, bggId: true },
      });

      const existingBggIdSet = new Set(
        matchedMechanics
          .map((mechanic) => mechanic.bggId)
          .filter((id): id is number => typeof id === 'number')
      );
      const missingMechanicBggIds = Array.from(
        new Set(mechanicBggIds.filter((id) => !existingBggIdSet.has(id)))
      );

      if (missingMechanicBggIds.length > 0) {
        const missingMechanicDetails = await bgg.thing(missingMechanicBggIds, { stats: false });
        const missingById = new Map(
          missingMechanicDetails.map((mechanic) => [Number(mechanic.id), mechanic])
        );

        const maxOrder = await prisma.gameMechanic.aggregate({
          _max: { order: true },
        });
        let nextOrder = (maxOrder._max.order ?? 0) + 1;

        for (const mechanicBggId of missingMechanicBggIds) {
          const alreadyCreated = await prisma.gameMechanic.findFirst({
            where: { bggId: mechanicBggId },
            select: { id: true, name: true, slug: true, bggId: true },
          });

          if (alreadyCreated) {
            matchedMechanics.push(alreadyCreated);
            continue;
          }

          const rawLinkName = mechanicLinks.find((link) => link.id === mechanicBggId)?.value;
          const bggMechanic = missingById.get(mechanicBggId);

          const sourceName = (bggMechanic?.name || rawLinkName || '').trim();
          if (!sourceName) {
            continue;
          }

          const translatedName = await translateText(sourceName, 'es', 'en');
          const sourceDescription = (bggMechanic?.description || '').trim();
          const translatedDescription = sourceDescription
            ? await translateText(sourceDescription, 'es', 'en')
            : '';
          const slug = await buildUniqueMechanicSlug(translatedName || sourceName);

          const created = await prisma.gameMechanic.create({
            data: {
              name: translatedName || sourceName,
              slug,
              description: translatedDescription || sourceDescription || null,
              bggId: mechanicBggId,
              bggName: sourceName,
              order: nextOrder,
              isActive: true,
            },
            select: { id: true, name: true, slug: true, bggId: true },
          });

          nextOrder += 1;
          matchedMechanics.push(created);
        }
      }
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