import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/game-complexities - List all game complexities
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const complexities = await prisma.gameComplexity.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    return NextResponse.json(complexities);
  } catch (error) {
    console.error('Error fetching game complexities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game complexities' },
      { status: 500 }
    );
  }
}

// POST /api/game-complexities - Create a new game complexity
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, description, icon, order, isActive } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await prisma.gameComplexity.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game complexity with this slug already exists' },
        { status: 400 }
      );
    }

    const complexity = await prisma.gameComplexity.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(complexity, { status: 201 });
  } catch (error) {
    console.error('Error creating game complexity:', error);
    return NextResponse.json(
      { error: 'Failed to create game complexity' },
      { status: 500 }
    );
  }
}
