import { NextResponse } from 'next/server';
import { bgg } from '@/lib/bgg/client';
import { prisma } from '@jssprz/ludo2go-database';
import { translateText } from '@/lib/google-translation';
import * as cheerio from 'cheerio';

type MechanicSummary = {
  id: string;
  name: string;
  slug: string;
  bggId: number | null;
};

type MechanicPrefill = {
  bggId: number;
  bggName: string;
  name: string;
  description?: string;
};

const BGG_SCRAPE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMechanicTitle(value: string): string {
  const normalized = normalizeWhitespace(value);
  return normalized
    .replace(/\s*[|\-]\s*board\s*game\s*geek\s*$/i, '')
    .replace(/\s*[|\-]\s*board\s*game\s*mechanic\s*$/i, '')
    .replace(/\s*[|\-]\s*boardgamegeek\s*$/i, '')
    .replace(/\s*[|\-]\s*boardgamemechanic\s*$/i, '')
    .trim();
}

function pickFirstNonEmpty(values: Array<string | undefined | null>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

async function scrapeBggMechanicPage(mechanicId: number): Promise<{ name: string; description: string }> {
  const mechanicUrl = `https://boardgamegeek.com/boardgamemechanic/${mechanicId}`;
  const response = await fetch(mechanicUrl, {
    headers: {
      'User-Agent': BGG_SCRAPE_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch BGG mechanic page (HTTP ${response.status})`);
  }

  const html = await response.text();
  const cfBlocked = /Just a moment\.\.\.|cf_chl|Enable JavaScript and cookies to continue/i.test(html);
  if (cfBlocked) {
    throw new Error('BGG blocked the scrape request with Cloudflare challenge');
  }

  const $ = cheerio.load(html);
  const rawTitle = pickFirstNonEmpty([
    $('meta[property="og:title"]').attr('content'),
    $('h1').first().text(),
    $('title').first().text(),
  ]);
  const rawDescription = pickFirstNonEmpty([
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="description"]').attr('content'),
    $('[data-testid="description"]').first().text(),
    $('.item-overview-description').first().text(),
    $('#description').first().text(),
  ]);

  const name = normalizeMechanicTitle(rawTitle);
  const description = normalizeWhitespace(rawDescription);

  if (!name) {
    throw new Error('Could not extract mechanic name from BGG mechanic page');
  }

  return { name, description };
}

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
  req: Request,
  { params }: { params: Promise<{ bggId: string }> }
) {
  const { bggId } = await params;
  const url = new URL(req.url);
  const entity = url.searchParams.get('entity');

  if (!bggId) {
    return NextResponse.json(
      { message: 'Missing bggId' },
      { status: 400 }
    );
  }

  try {
    if (entity === 'mechanic') {
      const mechanicId = Number(bggId);
      if (!Number.isFinite(mechanicId) || mechanicId <= 0) {
        return NextResponse.json(
          { message: 'Invalid mechanic bggId' },
          { status: 400 }
        );
      }

      const scraped = await scrapeBggMechanicPage(mechanicId);
      const sourceName = (scraped.name || '').trim();
      const sourceDescription = (scraped.description || '').trim();
      const translatedName = sourceName
        ? await translateText(sourceName, 'es', 'en')
        : '';
      const translatedDescription = sourceDescription
        ? await translateText(sourceDescription, 'es', 'en')
        : '';

      const existingMechanic = await prisma.gameMechanic.findFirst({
        where: { bggId: mechanicId },
        select: { id: true, name: true, slug: true, bggId: true },
      });

      const mechanicPrefill: MechanicPrefill = {
        bggId: mechanicId,
        bggName: sourceName,
        name: translatedName || sourceName,
        description: translatedDescription || sourceDescription || undefined,
      };

      return NextResponse.json({
        id: mechanicId,
        type: 'boardgamemechanic',
        name: sourceName,
        description: sourceDescription || undefined,
        mechanicPrefill,
        matchedMechanics: existingMechanic ? [existingMechanic] : [],
        unmatchedMechanics: existingMechanic || !sourceName
          ? []
          : [{ bggId: mechanicId, name: sourceName }],
      });
    }

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

          const rawLinkName = mechanicLinks.find((link) => link.id === mechanicBggId)?.value || '';
          const scrapedMechanic = await scrapeBggMechanicPage(mechanicBggId).catch((error) => {
            console.error('Failed to scrape mechanic page, falling back to link value', {
              mechanicBggId,
              error,
            });
            return { name: rawLinkName, description: '' };
          });

          const sourceName = (scrapedMechanic.name || rawLinkName || '').trim();
          if (!sourceName) {
            continue;
          }

          const translatedName = await translateText(sourceName, 'es', 'en');
          const sourceDescription = (scrapedMechanic.description || '').trim();
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