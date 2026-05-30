import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string; groupId: string }> };

// GET /api/bundles/[id]/groups/[groupId]/address-rule
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    const rule = await prisma.customizableBundleAddressRule.findUnique({
      where: { groupId },
    });
    if (!rule) return NextResponse.json(null);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching address rule:', error);
    return NextResponse.json({ error: 'Failed to fetch address rule' }, { status: 500 });
  }
}

// PUT /api/bundles/[id]/groups/[groupId]/address-rule
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();

  const {
    allowedRegions,
    excludedRegions,
    allowedCities,
    excludedCities,
    requireCityMatch,
    metadata,
  } = body;

  const data = {
    allowedRegions: allowedRegions ?? [],
    excludedRegions: excludedRegions ?? [],
    allowedCities: allowedCities ?? [],
    excludedCities: excludedCities ?? [],
    requireCityMatch: requireCityMatch ?? false,
    metadata: metadata ?? undefined,
  };

  try {
    const rule = await prisma.customizableBundleAddressRule.upsert({
      where: { groupId },
      create: { groupId, ...data },
      update: data,
    });
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error upserting address rule:', error);
    return NextResponse.json({ error: 'Failed to save address rule' }, { status: 500 });
  }
}

// DELETE /api/bundles/[id]/groups/[groupId]/address-rule
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    await prisma.customizableBundleAddressRule.delete({ where: { groupId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting address rule:', error);
    return NextResponse.json({ error: 'Failed to delete address rule' }, { status: 500 });
  }
}