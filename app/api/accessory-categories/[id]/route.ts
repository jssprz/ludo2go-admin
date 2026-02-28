import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/accessory-categories/[id] - Get a single accessory category
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const category = await prisma.accessoryCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { accessories: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Accessory category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching accessory category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accessory category' },
      { status: 500 }
    );
  }
}

// PUT /api/accessory-categories/[id] - Update an accessory category
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, icon, order, isActive } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists (but not for this category)
    const existingCategory = await prisma.accessoryCategory.findFirst({
      where: {
        slug,
        NOT: { id },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'An accessory category with this slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.accessoryCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating accessory category:', error);
    return NextResponse.json(
      { error: 'Failed to update accessory category' },
      { status: 500 }
    );
  }
}

// DELETE /api/accessory-categories/[id] - Delete an accessory category
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if category has associated accessories
    const category = await prisma.accessoryCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { accessories: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Accessory category not found' }, { status: 404 });
    }

    if (category._count.accessories > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${category._count.accessories} associated accessory(ies). Please reassign or remove them first.`,
        },
        { status: 400 }
      );
    }

    await prisma.accessoryCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting accessory category:', error);
    return NextResponse.json(
      { error: 'Failed to delete accessory category' },
      { status: 500 }
    );
  }
}
