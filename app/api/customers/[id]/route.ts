import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/customers/[id] — full 360 data
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        where: { status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              variant: { select: { sku: true, product: { select: { name: true } } } },
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
      },
      addresses: true,
      events: {
        orderBy: { occurredAt: 'desc' },
        take: 200,
        select: { eventType: true, occurredAt: true, pagePath: true, properties: true },
      },
      carts: {
        where: { status: 'active' },
        include: { items: { select: { quantity: true, unitPriceAtAdd: true } } },
        take: 1,
      },
      wishlist: { include: { _count: { select: { items: true } } } },
    },
  });

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(customer);
}

// PATCH /api/customers/[id] — update editable fields
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ['firstName', 'lastName', 'phone', 'newsletter', 'notifications'] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(updated);
}
