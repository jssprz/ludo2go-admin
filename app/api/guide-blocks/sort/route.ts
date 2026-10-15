import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@jssprz/ludo2go-database';
import { guideEditAttribution, resolveGuideActor } from '@/lib/guide-attribution';
import { GuideBlockError, guideBlockErrorResponse, parseGuideBlockSortRequest, sortGuideBlocks } from '@/lib/guide-block-persistence';

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminUserId = session.user.id;

    const updates = await parseGuideBlockSortRequest(request);
    const sorted = await prisma.$transaction(
      async (transaction) => {
        const actor = await resolveGuideActor(transaction, adminUserId);
        if (!actor) return false;
        await sortGuideBlocks(transaction, updates);
        const block = await transaction.guideBlock.findUnique({ where: { id: updates[0].id }, select: { guideId: true } });
        if (!block) throw new GuideBlockError('Guide block not found', 404);
        await transaction.guide.update({ where: { id: block.guideId }, data: guideEditAttribution(actor) });
        return true;
      },
      { isolationLevel: 'Serializable' }
    );

    if (!sorted) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = guideBlockErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('Error updating guide block sort orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}