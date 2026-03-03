import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      productId,
      sku,
      eanUpc,
      edition,
      language,
      condition,
      status,
      displayTitleShort,
      displayTitleLong,
    } = body;

    if (!productId || !sku) {
      return NextResponse.json(
        { message: 'productId and sku are required' },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      );
    }

    // Check SKU uniqueness
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku },
    });

    if (existingSku) {
      return NextResponse.json(
        { message: `SKU "${sku}" already exists` },
        { status: 409 }
      );
    }

    // Check EAN/UPC uniqueness if provided
    if (eanUpc) {
      const existingEan = await prisma.productVariant.findUnique({
        where: { eanUpc },
      });

      if (existingEan) {
        return NextResponse.json(
          { message: `EAN/UPC "${eanUpc}" already exists` },
          { status: 409 }
        );
      }
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku,
        eanUpc: eanUpc || null,
        edition: edition || null,
        language: language || 'es',
        condition: condition || 'new',
        status: status || 'draft',
        displayTitleShort: displayTitleShort || null,
        displayTitleLong: displayTitleLong || null,
      },
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (error: any) {
    console.error('Error creating variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
