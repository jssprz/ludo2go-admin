import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildCreateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { put } from '@vercel/blob';
import { createAndStoreThumbnailFromUrl } from '@/lib/media-thumbnails';

function isYouTubeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
}

// GET /api/media - List all media assets
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '24');

  try {
    const where: any = {};

    if (kind && kind !== 'all') {
      where.kind = kind;
    }

    if (search) {
      where.OR = [
        { alt: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
        { copyright: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [media, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              productRefs: true,
              variantRefs: true,
            },
          },
        },
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    return NextResponse.json({
      media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/media - Upload new media asset
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const adminUserId = getAdminUserIdFromSession(session);

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const {
        kind,
        url,
        thumbUrl,
        mime,
        alt,
        copyright,
        locale,
      } = body ?? {};

      if (kind !== 'video') {
        return NextResponse.json(
          { message: 'Only video kind is supported for JSON create requests' },
          { status: 400 }
        );
      }

      if (!url || typeof url !== 'string') {
        return NextResponse.json(
          { message: 'Video URL is required' },
          { status: 400 }
        );
      }

      if (!isYouTubeUrl(url)) {
        return NextResponse.json(
          {
            message:
              'Only YouTube URLs are supported. Use a watch URL or embed URL.',
          },
          { status: 400 }
        );
      }

      if (thumbUrl !== undefined && thumbUrl !== null && typeof thumbUrl !== 'string') {
        return NextResponse.json(
          { message: 'thumbUrl must be a string when provided' },
          { status: 400 }
        );
      }

      if (mime !== undefined && mime !== null && typeof mime !== 'string') {
        return NextResponse.json(
          { message: 'mime must be a string when provided' },
          { status: 400 }
        );
      }

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          kind: 'video',
          url,
          thumbUrl: thumbUrl || null,
          width: null,
          height: null,
          sizeBytes: null,
          mime: mime || 'text/html',
          locale: typeof locale === 'string' && locale ? locale : null,
          alt: typeof alt === 'string' && alt ? alt : null,
          copyright:
            typeof copyright === 'string' && copyright ? copyright : null,
          ...buildCreateAuditFields(adminUserId),
        },
      });

      return NextResponse.json(mediaAsset, { status: 201 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const alt = formData.get('alt') as string | null;
    const copyright = formData.get('copyright') as string | null;
    const locale = formData.get('locale') as string | null;

    if (!file) {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/avif',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'audio/mpeg',
      'audio/wav',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Determine media kind from mime type
    let kind: 'image' | 'video' | 'pdf' | 'audio' | 'model3d' = 'image';
    if (file.type.startsWith('video/')) {
      kind = 'video';
    } else if (file.type === 'application/pdf') {
      kind = 'pdf';
    } else if (file.type.startsWith('audio/')) {
      kind = 'audio';
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `media/${kind}/${timestamp}-${file.name}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    const thumbnail =
      kind === 'image'
        ? await createAndStoreThumbnailFromUrl({
            sourceUrl: blob.url,
            sourceMime: file.type,
            pathnameHint: file.name,
          })
        : null;

    // Create media asset in database
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        kind,
        url: blob.url,
        thumbUrl: thumbnail?.thumbUrl || (kind === 'image' ? blob.url : null),
        width: thumbnail?.width ?? null,
        height: thumbnail?.height ?? null,
        sizeBytes: file.size,
        mime: file.type,
        locale: locale || null,
        alt: alt || file.name.replace(/\.[^/.]+$/, ''),
        copyright: copyright || null,
        ...buildCreateAuditFields(adminUserId),
      },
    });

    return NextResponse.json(mediaAsset, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
