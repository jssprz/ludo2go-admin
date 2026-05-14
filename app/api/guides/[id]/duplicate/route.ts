import { NextResponse } from 'next/server';
import { GuideStatus, Prisma } from '@prisma/client';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

async function generateUniqueSlug(baseSlug: string) {
  const normalizedBase = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'guide-copy';

  let attempt = 1;
  let candidate = `${normalizedBase}-copy`;

  while (true) {
    const existing = await prisma.guide.findUnique({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }

    attempt += 1;
    candidate = `${normalizedBase}-copy-${attempt}`;
  }
}

// POST /api/guides/[id]/duplicate - Duplicate a guide with blocks and product variants
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const sourceGuide = await prisma.guide.findUnique({
      where: { id },
      include: {
        blocks: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          select: { variantId: true },
        },
      },
    });

    if (!sourceGuide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    const duplicateSlug = await generateUniqueSlug(sourceGuide.slug);

    const duplicatedGuide = await prisma.$transaction(async (tx) => {
      const created = await tx.guide.create({
        data: {
          slug: duplicateSlug,
          title: `${sourceGuide.title} (Copy)`,
          subtitle: sourceGuide.subtitle,
          excerpt: sourceGuide.excerpt,
          status: GuideStatus.draft,
          coverImageUrl: sourceGuide.coverImageUrl,
          coverImageAlt: sourceGuide.coverImageAlt,
          intro: sourceGuide.intro,
          content: sourceGuide.content,
          publishedAt: null,
          authorId: sourceGuide.authorId,
          authorName: sourceGuide.authorName,
          seoTitle: sourceGuide.seoTitle,
          seoDescription: sourceGuide.seoDescription,
          seoCanonicalUrl: sourceGuide.seoCanonicalUrl,
          ogImageUrl: sourceGuide.ogImageUrl,
          noindex: sourceGuide.noindex,
          categoryId: sourceGuide.categoryId,
          tags: sourceGuide.tags,
          targetKeyword: sourceGuide.targetKeyword,
          searchIntent: sourceGuide.searchIntent,
        },
      });

      if (sourceGuide.blocks.length > 0) {
        await tx.guideBlock.createMany({
          data: sourceGuide.blocks.map((block) => ({
            guideId: created.id,
            type: block.type,
            sortOrder: block.sortOrder,
            title: block.title,
            body: block.body,
            imageUrl: block.imageUrl,
            imageAlt: block.imageAlt,
            buttonText: block.buttonText,
            buttonUrl: block.buttonUrl,
            data: block.data === null
              ? Prisma.DbNull
              : (block.data as Prisma.InputJsonValue),
          })),
        });
      }

      if (sourceGuide.variants.length > 0) {
        await tx.guideProductVariant.createMany({
          data: sourceGuide.variants.map((variant) => ({
            guideId: created.id,
            variantId: variant.variantId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const guideWithCounts = await prisma.guide.findUnique({
      where: { id: duplicatedGuide.id },
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

    return NextResponse.json(guideWithCounts, { status: 201 });
  } catch (error) {
    console.error('Error duplicating guide:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate guide' },
      { status: 500 }
    );
  }
}
