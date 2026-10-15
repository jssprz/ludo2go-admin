import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@jssprz/ludo2go-database';
import { guideBlockErrorResponse, parseGuideBlockSortRequest, sortGuideBlocks } from '@/lib/guide-block-persistence';

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await parseGuideBlockSortRequest(request);
    await prisma.$transaction(
      (transaction) => sortGuideBlocks(transaction, updates),
      { isolationLevel: 'Serializable' }
    );

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