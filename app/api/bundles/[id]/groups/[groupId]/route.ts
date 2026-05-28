import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string; groupId: string }> };

// PUT /api/bundles/[id]/groups/[groupId] – Update option group
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();

  const {
    name,
    description,
    type,
    minSelections,
    maxSelections,
    required,
    sortOrder,
    active,
  } = body;

  try {
    const group = await prisma.customizableBundleOptionGroup.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined ? { name } : {}),
        description: description !== undefined ? (description || null) : undefined,
        ...(type !== undefined ? { type } : {}),
        ...(minSelections !== undefined ? { minSelections } : {}),
        ...(maxSelections !== undefined ? { maxSelections } : {}),
        ...(required !== undefined ? { required } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        variantSelectionRule: true,
      },
    });
    return NextResponse.json(group);
  } catch (error) {
    console.error('Error updating option group:', error);
    return NextResponse.json({ error: 'Failed to update option group' }, { status: 500 });
  }
}

// DELETE /api/bundles/[id]/groups/[groupId]
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    await prisma.customizableBundleOptionGroup.delete({ where: { id: groupId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting option group:', error);
    return NextResponse.json({ error: 'Failed to delete option group' }, { status: 500 });
  }
}
