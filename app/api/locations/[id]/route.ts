import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/locations/[id]
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

// PUT /api/locations/[id]
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, description, addressLine1, addressLine2, city, region, postalCode, country, lat, lng, phone, isActive } = body;

    if (!code || !name || !addressLine1 || !city || !country) {
      return NextResponse.json(
        { error: 'Code, name, address line 1, city, and country are required' },
        { status: 400 }
      );
    }

    // Check if code already exists (but not for this location)
    const existing = await prisma.location.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A location with this code already exists' },
        { status: 400 }
      );
    }

    const location = await prisma.location.update({
      where: { id },
      data: {
        code,
        name,
        description: description || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        region: region || null,
        postalCode: postalCode || null,
        country,
        lat: lat != null ? parseFloat(lat) : null,
        lng: lng != null ? parseFloat(lng) : null,
        phone: phone || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

// DELETE /api/locations/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    await prisma.location.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}
