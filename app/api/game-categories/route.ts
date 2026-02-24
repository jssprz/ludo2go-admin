import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/game-categories - List all game categories
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = await prisma.gameCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        media: true,
        _count: {
          select: { games: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching game categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game categories' },
      { status: 500 }
    );
  }
}

// POST /api/game-categories - Create a new game category
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, description, icon, order, isActive, mediaId } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingCategory = await prisma.gameCategory.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A game category with this slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.gameCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
        mediaId: mediaId || null,
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating game category:', error);
    return NextResponse.json(
      { error: 'Failed to create game category' },
      { status: 500 }
    );
  }
}
