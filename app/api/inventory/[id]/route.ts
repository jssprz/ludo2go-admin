import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: variantId } = await context.params;
    const body = await request.json();
    const { locationId, onHand, reserved } = body;

    // Validate required fields
    if (!locationId) {
      return NextResponse.json(
        { message: 'locationId is required' },
        { status: 400 }
      );
    }

    if (typeof onHand !== 'number' || typeof reserved !== 'number') {
      return NextResponse.json(
        { message: 'onHand and reserved must be numbers' },
        { status: 400 }
      );
    }

    if (onHand < 0 || reserved < 0) {
      return NextResponse.json(
        { message: 'onHand and reserved cannot be negative' },
        { status: 400 }
      );
    }

    // Check if variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 }
      );
    }

    // Upsert inventory record
    const inventory = await prisma.inventory.upsert({
      where: {
        variantId_locationId: {
          variantId,
          locationId,
        },
      },
      update: {
        onHand,
        reserved,
      },
      create: {
        variantId,
        locationId,
        onHand,
        reserved,
      },
    });

    return NextResponse.json(inventory);
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
