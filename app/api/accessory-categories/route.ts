import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/accessory-categories - List all accessory categories
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = await prisma.accessoryCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { accessories: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching accessory categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accessory categories' },
      { status: 500 }
    );
  }
}

// POST /api/accessory-categories - Create a new accessory category
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
    const existingCategory = await prisma.accessoryCategory.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'An accessory category with this slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.accessoryCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating accessory category:', error);
    return NextResponse.json(
      { error: 'Failed to create accessory category' },
      { status: 500 }
    );
  }
}
