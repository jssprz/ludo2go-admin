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

    const { id } = await context.params;
    const body = await request.json();

    const existingVariant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!existingVariant) {
      return NextResponse.json({ message: 'Variant not found' }, { status: 404 });
    }

    const data: Record<string, any> = {};

    // Update status if provided
    if (body.status !== undefined) {
      data.status = body.status;
    }

    // Update scheduled date
    if (body.activeAtScheduled !== undefined) {
      data.activeAtScheduled = body.activeAtScheduled
        ? new Date(body.activeAtScheduled)
        : null;
    }

    const updated = await prisma.productVariant.update({
      where: { id },
      data,
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating variant schedule:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
