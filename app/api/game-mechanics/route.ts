import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/game-mechanics - List all game mechanics
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mechanics = await prisma.gameMechanic.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return NextResponse.json(mechanics);
  } catch (error) {
    console.error('Error fetching game mechanics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game mechanics' },
      { status: 500 }
    );
  }
}

// POST /api/game-mechanics - Create a new game mechanic
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

    const existing = await prisma.gameMechanic.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game mechanic with this slug already exists' },
        { status: 400 }
      );
    }

    const mechanic = await prisma.gameMechanic.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: typeof order === 'number' ? order : 0,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return NextResponse.json(mechanic, { status: 201 });
  } catch (error) {
    console.error('Error creating game mechanic:', error);
    return NextResponse.json(
      { error: 'Failed to create game mechanic' },
      { status: 500 }
    );
  }
}
