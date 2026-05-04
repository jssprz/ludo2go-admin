import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/guide-categories - List all guide categories
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = await prisma.guideCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { guides: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching guide categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide categories' },
      { status: 500 }
    );
  }
}

// POST /api/guide-categories - Create a new guide category
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, description } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await prisma.guideCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.guideCategory.create({
      data: {
        name,
        slug,
        description,
      },
      include: {
        _count: {
          select: { guides: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating guide category:', error);
    return NextResponse.json(
      { error: 'Failed to create guide category' },
      { status: 500 }
    );
  }
}