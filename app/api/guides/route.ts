import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { GuideStatus } from '@prisma/client';

// GET /api/guides - List all guides
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as GuideStatus | null;
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const guides = await prisma.guide.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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

    return NextResponse.json(guides);
  } catch (error) {
    console.error('Error fetching guides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guides' },
      { status: 500 }
    );
  }
}

// POST /api/guides - Create a new guide
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      slug,
      title,
      subtitle,
      excerpt,
      status = GuideStatus.draft,
      coverImageUrl,
      coverImageAlt,
      intro,
      content,
      publishedAt,
      authorId,
      authorName,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      ogImageUrl,
      noindex = false,
      categoryId,
      tags = [],
      targetKeyword,
      searchIntent,
    } = body;

    if (!title || !slug) {
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await prisma.guide.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      );
    }

    const guide = await prisma.guide.create({
      data: {
        slug,
        title,
        subtitle,
        excerpt,
        status,
        coverImageUrl,
        coverImageAlt,
        intro,
        content,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        authorId,
        authorName,
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

    return NextResponse.json(guide, { status: 201 });
  } catch (error) {
    console.error('Error creating guide:', error);
    return NextResponse.json(
      { error: 'Failed to create guide' },
      { status: 500 }
    );
  }
}