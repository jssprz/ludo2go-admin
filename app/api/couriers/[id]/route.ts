import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { courierSchema } from '@/lib/courier';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const courier = await prisma.courier.update({ where: { id }, data: parsed.data });
    return NextResponse.json(courier);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'A courier with this name already exists.' }, { status: 409 });
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Courier not found.' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Failed to update courier.' }, { status: 500 });
  }
}