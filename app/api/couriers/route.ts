import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { courierSchema } from '@/lib/courier';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const couriers = await prisma.courier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, trackingUrlTemplate: true }
    });
    return NextResponse.json(couriers);
  } catch {
    return NextResponse.json({ error: 'Failed to load couriers.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const parsed = courierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const courier = await prisma.courier.create({ data: parsed.data });
    return NextResponse.json(courier, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A courier with this name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create courier.' }, { status: 500 });
  }
}