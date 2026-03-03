import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/game-themes - List all game themes
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const themes = await prisma.gameTheme.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return NextResponse.json(themes);
  } catch (error) {
    console.error('Error fetching game themes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game themes' },
      { status: 500 }
    );
  }
}

// POST /api/game-themes - Create a new game theme
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

    const existing = await prisma.gameTheme.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game theme with this slug already exists' },
        { status: 400 }
      );
    }

    const theme = await prisma.gameTheme.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: typeof order === 'number' ? order : 0,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return NextResponse.json(theme, { status: 201 });
  } catch (error) {
    console.error('Error creating game theme:', error);
    return NextResponse.json(
      { error: 'Failed to create game theme' },
      { status: 500 }
    );
  }
}
