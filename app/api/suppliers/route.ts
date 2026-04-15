import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/suppliers - List all suppliers
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const suppliers = await prisma.supplier.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { costPrices: true, purchaseOrders: true },
        },
      },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - Create a new supplier
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      code, name, contactName, email, phone, website,
      country, region, notes, paymentTerms, leadTimeDays, isActive,
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.supplier.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: 'A supplier with this code already exists' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        country: country || null,
        region: region || null,
        notes: notes || null,
        paymentTerms: paymentTerms || null,
        leadTimeDays: typeof leadTimeDays === 'number' ? leadTimeDays : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
