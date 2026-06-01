import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/bundles/rule-options - Catalog options used by bundle variant selection rules
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [categories, themes, mechanics, locations] = await Promise.all([
      prisma.gameCategory.findMany({
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
      prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
    ]);

    return NextResponse.json({ categories, themes, mechanics, locations });
  } catch (error) {
    console.error('Error fetching bundle rule options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundle rule options' },
      { status: 500 }
    );
  }
}
