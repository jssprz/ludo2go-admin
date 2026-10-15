import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { GuideStatus } from '@prisma/client';
import { guideEditAttribution, resolveGuideActor } from '@/lib/guide-attribution';
import { parseGuideSchedule } from '@/lib/guide-scheduling';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/guides/[id] - Get a single guide
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const guide = await prisma.guide.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        blocks: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { blocks: true, variants: true },
        },
      },
    });

    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    return NextResponse.json(guide);
  } catch (error) {
    console.error('Error fetching guide:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide' },
      { status: 500 }
    );
  }
}

// PUT /api/guides/[id] - Update a guide
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const actor = await resolveGuideActor(prisma, session.user.id);
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const {
      slug,
      title,
      subtitle,
      excerpt,
      status,
      coverImageUrl,
      coverImageAlt,
      intro,
      content,
      publishedAt,
      scheduledAt,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      ogImageUrl,
      noindex,
      categoryId,
      tags,
      targetKeyword,
      searchIntent,
    } = body;

    if (typeof title !== 'string' || !title.trim() || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      );
    }

    const current = status === undefined || (status === GuideStatus.scheduled && scheduledAt === undefined)
      ? await prisma.guide.findUnique({ where: { id }, select: { status: true, scheduledAt: true } })
      : null;
    if ((status === undefined || (status === GuideStatus.scheduled && scheduledAt === undefined)) && !current) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }
    const effectiveStatus = status ?? current?.status;
    const existingSchedule = current?.scheduledAt?.toISOString();
    const preserveSchedule = scheduledAt === undefined && effectiveStatus === GuideStatus.scheduled && current?.status === GuideStatus.scheduled && Boolean(current.scheduledAt);
    const schedule = preserveSchedule
      ? { scheduledAt: current!.scheduledAt }
      : parseGuideSchedule(effectiveStatus, scheduledAt === undefined ? existingSchedule : scheduledAt);
    if ('error' in schedule && schedule.error) return NextResponse.json({ error: schedule.error }, { status: 400 });

    // Check if slug already exists (excluding current guide)
    const existing = await prisma.guide.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      );
    }

    const guide = await prisma.guide.update({
      where: { id },
      data: {
        slug,
        title,
        subtitle,
        excerpt,
        status,
        scheduledAt: schedule.scheduledAt,
        coverImageUrl,
        coverImageAlt,
        intro,
        content,
        publishedAt: publishedAt === undefined ? undefined : publishedAt === null ? null : new Date(publishedAt),
        ...guideEditAttribution(actor),
        seoTitle,
        seoDescription,
        seoCanonicalUrl,
        ogImageUrl,
        noindex,
        categoryId,
        tags,
        targetKeyword,
        searchIntent,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { blocks: true, variants: true },
        },
      },
    });

    return NextResponse.json(guide);
  } catch (error) {
    console.error('Error updating guide:', error);
    return NextResponse.json(
      { error: 'Failed to update guide' },
      { status: 500 }
    );
  }
}

// DELETE /api/guides/[id] - Delete a guide
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    await prisma.guide.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guide:', error);
    return NextResponse.json(
      { error: 'Failed to delete guide' },
      { status: 500 }
    );
  }
}