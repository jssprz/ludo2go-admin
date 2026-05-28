import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/bundles/[id]/groups – List option groups for a bundle
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const groups = await prisma.customizableBundleOptionGroup.findMany({
      where: { customizableBundleId: id },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        variantSelectionRule: true,
      },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching option groups:', error);
    return NextResponse.json({ error: 'Failed to fetch option groups' }, { status: 500 });
  }
}

// POST /api/bundles/[id]/groups – Create an option group
export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
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

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
  }

  try {
    // Ensure CustomizableBundleDetails exists
    const details = await prisma.customizableBundleDetails.findUnique({
      where: { bundleProductId: id },
    });
    if (!details) {
      return NextResponse.json(
        { error: 'No CustomizableBundleDetails found for this bundle. Set bundleType to customizable first.' },
        { status: 400 }
      );
    }

    const group = await prisma.customizableBundleOptionGroup.create({
      data: {
        customizableBundleId: id,
        name,
        description: description ?? null,
        type,
        minSelections: minSelections ?? 0,
        maxSelections: maxSelections ?? 1,
        required: required ?? false,
        sortOrder: sortOrder ?? 0,
        active: active ?? true,
      },
      include: {
        options: true,
        variantSelectionRule: true,
      },
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('Error creating option group:', error);
    return NextResponse.json({ error: 'Failed to create option group' }, { status: 500 });
  }
}
