import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

// GET single product
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        game: true,
        accessory: true,
        bundle: true,
        bgg: true,
        variants: true,
      },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT update product
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      brand,
      kind,
      status,
      tags,
      shortDescription,
      description,
      timelineId,
    } = body;

    const { productId } = await params;

    // Update product
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        slug,
        brand,
        kind,
        status,
        tags,
        shortDescription,
        description,
      },
      include: {
        game: true,
      },
    });

    // If it's a game product, update the timeline
    if (kind === 'game' && product.game) {
      await prisma.gameDetails.update({
        where: { productId: productId },
        data: {
          timelineId: timelineId || null,
        },
      });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE product
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}
