import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/locations - List all inventory locations
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

// POST /api/locations - Create a new inventory location
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, name, description, addressLine1, addressLine2, city, region, postalCode, country, lat, lng, phone, isActive } = body;

    if (!code || !name || !addressLine1 || !city || !country) {
      return NextResponse.json(
        { error: 'Code, name, address line 1, city, and country are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.location.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A location with this code already exists' },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
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

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
