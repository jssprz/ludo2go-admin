import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { GuideBlockType } from '@prisma/client';

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
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      guideId,
      type,
      sortOrder,
      title,
      body: blockBody,
      imageUrl,
      imageAlt,
      buttonText,
      buttonUrl,
      data,
    } = body;

    if (!guideId || !type) {
      return NextResponse.json(
        { error: 'Guide ID and type are required' },
        { status: 400 }
      );
    }

    // Verify guide exists
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
    });

    if (!guide) {
      return NextResponse.json(
        { error: 'Guide not found' },
        { status: 404 }
      );
    }

    const block = await prisma.guideBlock.create({
      data: {
        guideId,
        type,
        sortOrder: sortOrder || 0,
        title,
        body: blockBody,
        imageUrl,
        imageAlt,
        buttonText,
        buttonUrl,
        data,
      },
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

    return NextResponse.json(block, { status: 201 });
  } catch (error) {
    console.error('Error creating guide block:', error);
    return NextResponse.json(
      { error: 'Failed to create guide block' },
      { status: 500 }
    );
  }
}