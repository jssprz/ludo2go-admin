import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const pickupLocation = await prisma.pickupLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            customers: true,
          },
        },
      },
    });

    if (!pickupLocation) {
      return NextResponse.json(
        { message: 'Pickup location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(pickupLocation);
  } catch (error: any) {
    console.error('Error fetching pickup location:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
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

    // Check if location exists
    const existing = await prisma.pickupLocation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Pickup location not found' },
        { status: 404 }
      );
    }

    // Check if code is unique (if changed)
    if (code !== existing.code) {
      const codeExists = await prisma.pickupLocation.findUnique({
        where: { code },
      });

      if (codeExists) {
        return NextResponse.json(
          { message: 'A pickup location with this code already exists' },
          { status: 400 }
        );
      }
    }

    const pickupLocation = await prisma.pickupLocation.update({
      where: { id },
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
    console.error('Error updating pickup location:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Check if location exists
    const existing = await prisma.pickupLocation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Pickup location not found' },
        { status: 404 }
      );
    }

    // Partial update
    const pickupLocation = await prisma.pickupLocation.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(pickupLocation);
  } catch (error: any) {
    console.error('Error updating pickup location:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if location exists
    const existing = await prisma.pickupLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            customers: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Pickup location not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if location has orders
    if (existing._count.orders > 0) {
      return NextResponse.json(
        { message: 'Cannot delete pickup location with existing orders' },
        { status: 400 }
      );
    }

    await prisma.pickupLocation.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Pickup location deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting pickup location:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
