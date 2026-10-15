import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { deleteGuideBlock, guideBlockErrorResponse, parseGuideBlockRequest, saveGuideBlock } from '@/lib/guide-block-persistence';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/guide-blocks/[id] - Get a single guide block
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const block = await prisma.guideBlock.findUnique({
      where: { id },
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

    if (!block) {
      return NextResponse.json({ error: 'Guide block not found' }, { status: 404 });
    }

    return NextResponse.json(block);
  } catch (error) {
    console.error('Error fetching guide block:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide block' },
      { status: 500 }
    );
  }
}

// PUT /api/guide-blocks/[id] - Update a guide block
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await parseGuideBlockRequest(request);
    const block = await prisma.$transaction(
      (transaction) => saveGuideBlock(transaction, payload, id),
      { isolationLevel: 'Serializable' }
    );

    return NextResponse.json(block);
  } catch (error) {
    const response = guideBlockErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('Error updating guide block:', error);
    return NextResponse.json(
      { error: 'Failed to update guide block' },
      { status: 500 }
    );
  }
}

// DELETE /api/guide-blocks/[id] - Delete a guide block
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    await prisma.$transaction(
      (transaction) => deleteGuideBlock(transaction, id),
      { isolationLevel: 'Serializable' }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = guideBlockErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('Error deleting guide block:', error);
    return NextResponse.json(
      { error: 'Failed to delete guide block' },
      { status: 500 }
    );
  }
}