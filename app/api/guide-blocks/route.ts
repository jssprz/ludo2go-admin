import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { guideEditAttribution, resolveGuideActor } from '@/lib/guide-attribution';
import { guideBlockErrorResponse, parseGuideBlockRequest, saveGuideBlock } from '@/lib/guide-block-persistence';

// GET /api/guide-blocks - List guide blocks (optionally filtered by guideId)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const guideId = searchParams.get('guideId');

    const where: any = {};

    if (guideId) {
      where.guideId = guideId;
    }

    const blocks = await prisma.guideBlock.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        guide: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json(blocks);
  } catch (error) {
    console.error('Error fetching guide blocks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide blocks' },
      { status: 500 }
    );
  }
}

// POST /api/guide-blocks - Create a new guide block
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const adminUserId = session.user.id;

  try {
    const payload = await parseGuideBlockRequest(request, true);
    const block = await prisma.$transaction(
      async (transaction) => {
        const actor = await resolveGuideActor(transaction, adminUserId);
        if (!actor) return null;
        const saved = await saveGuideBlock(transaction, payload);
        await transaction.guide.update({ where: { id: saved.guideId }, data: guideEditAttribution(actor) });
        return saved;
      },
      { isolationLevel: 'Serializable' }
    );

    if (!block) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(block, { status: 201 });
  } catch (error) {
    const response = guideBlockErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('Error creating guide block:', error);
    return NextResponse.json(
      { error: 'Failed to create guide block' },
      { status: 500 }
    );
  }
}