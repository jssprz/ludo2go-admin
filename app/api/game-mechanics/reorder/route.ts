import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type ReorderUpdate = {
  id: string;
  order: number;
};

// PUT /api/game-mechanics/reorder - Reorder game mechanics
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
    }

    const normalizedUpdates = updates.filter(
      (update: ReorderUpdate) =>
        typeof update?.id === 'string' && typeof update?.order === 'number'
    );

    if (normalizedUpdates.length !== updates.length) {
      return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
    }

    await prisma.$transaction(
      normalizedUpdates.map((update: ReorderUpdate) =>
        prisma.gameMechanic.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering game mechanics:', error);
    return NextResponse.json(
      { error: 'Failed to reorder mechanics' },
      { status: 500 }
    );
  }
}
