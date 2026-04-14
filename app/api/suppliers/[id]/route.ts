import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/suppliers/[id]
export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        costPrices: {
          include: { variant: { include: { product: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

// PUT /api/suppliers/[id]
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      code, name, contactName, email, phone, website,
      country, region, notes, paymentTerms, leadTimeDays, isActive,
    } = body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(name !== undefined ? { name } : {}),
        contactName: contactName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        website: website ?? null,
        country: country ?? null,
        region: region ?? null,
        notes: notes ?? null,
        paymentTerms: paymentTerms ?? null,
        leadTimeDays: typeof leadTimeDays === 'number' ? leadTimeDays : null,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ message: 'Supplier deleted' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
