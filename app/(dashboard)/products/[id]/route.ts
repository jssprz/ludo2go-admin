import { NextResponse } from 'next/server';
import { updateProduct } from '@/lib/db';

type ProductStatus = 'draft' | 'active' | 'archived';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json();

  try {
    const updated = await updateProduct({
        id: id,
        name: body.name,
        slug: body.slug,
        brand: body.brand,
        kind: body.kind,
        status: body.status as ProductStatus,
        tags: body.tags ?? [],
        shortDescription: body.shortDescription,
        description: body.description,
      })

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { message: 'Error updating product' },
      { status: 500 }
    );
  }
}