import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildUpdateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { checkMediaTransparencyFromUrl } from '@/lib/media-transparency';

const BATCH_SIZE = 25;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cursor = typeof body.cursor === 'string' && body.cursor ? body.cursor : null;
    const assets = await prisma.mediaAsset.findMany({
      where: { kind: 'image', ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, url: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    const failedIds: string[] = [];
    let checked = 0;
    let transparent = 0;
    const auditFields = buildUpdateAuditFields(getAdminUserIdFromSession(session));

    for (const asset of assets) {
      try {
        const result = await checkMediaTransparencyFromUrl(asset.url);
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { hasTransparentBackground: result, ...auditFields },
        });
        checked += 1;
        if (result) transparent += 1;
      } catch (error) {
        console.error(`Failed to check transparency for media ${asset.id}:`, error);
        failedIds.push(asset.id);
      }
    }

    return NextResponse.json({
      scanned: assets.length,
      checked,
      transparent,
      failedIds,
      nextCursor: assets.length === BATCH_SIZE ? assets[assets.length - 1].id : null,
    });
  } catch (error: any) {
    console.error('Failed to check media transparency:', error);
    return NextResponse.json({ message: error?.message || 'Failed to check media transparency' }, { status: 500 });
  }
}