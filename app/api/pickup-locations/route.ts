import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const pickupLocations = await prisma.pickupLocation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(pickupLocations);
  } catch (error: any) {
    console.error('Error fetching pickup locations:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      code,
      name,
      description,
      addressLine1,
      addressLine2,
      city,
      region,
      postalCode,
      country,
      lat,
      lng,
      phone,
      isActive,
    } = body;

    // Validate required fields
    if (!code || !name || !addressLine1 || !city || !country) {
      return NextResponse.json(
        { message: 'Missing required fields: code, name, addressLine1, city, country' },
        { status: 400 }
      );
    }

    // Check if code is unique
    const existing = await prisma.pickupLocation.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'A pickup location with this code already exists' },
        { status: 400 }
      );
    }

    const pickupLocation = await prisma.pickupLocation.create({
      data: {
        code,
        name,
        description,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        lat,
        lng,
        phone,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(pickupLocation);
  } catch (error: any) {
    console.error('Error creating pickup location:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
