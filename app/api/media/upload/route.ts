import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildCreateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { createAndStoreThumbnailFromUrl } from '@/lib/media-thumbnails';

// POST /api/media/upload - Handle client-side Vercel Blob uploads
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error('Unauthorized');
        }

        const adminUserId = getAdminUserIdFromSession(session);
        let parsedPayload: Record<string, any> = {};

        if (typeof clientPayload === 'string' && clientPayload.length > 0) {
          try {
            parsedPayload = JSON.parse(clientPayload);
          } catch {
            parsedPayload = { rawPayload: clientPayload };
          }
        }

        const tokenPayload = JSON.stringify({
          ...parsedPayload,
          adminUserId,
        });

        return {
          allowedContentTypes: [
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
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          tokenPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          console.log('Upload completed:', blob);

          const payload = tokenPayload ? JSON.parse(tokenPayload) : {};

          const sizeBytes =
            typeof payload.sizeBytes === 'number' ? payload.sizeBytes : null;

          let kind: 'image' | 'video' | 'pdf' | 'audio' | 'model3d' = 'image';

          if (blob.contentType?.startsWith('video/')) {
            kind = 'video';
          } else if (blob.contentType === 'application/pdf') {
            kind = 'pdf';
          } else if (blob.contentType?.startsWith('audio/')) {
            kind = 'audio';
          }

          const filename = blob.pathname.split('/').pop() || 'untitled';
          const alt = filename.replace(/\.[^/.]+$/, '').replace(/^\d+-/, '');
          const thumbnail =
            kind === 'image'
              ? await createAndStoreThumbnailFromUrl({
                  sourceUrl: blob.url,
                  sourceMime: blob.contentType,
                  pathnameHint: filename,
                })
              : null;

          const created = await prisma.mediaAsset.create({
            data: {
              kind,
              url: blob.url,
              thumbUrl: thumbnail?.thumbUrl || (kind === 'image' ? blob.url : null),
              width: thumbnail?.width ?? null,
              height: thumbnail?.height ?? null,
              sizeBytes,
              mime: blob.contentType || payload.mime || 'application/octet-stream',
              locale: null,
              alt,
              copyright: null,
              ...buildCreateAuditFields(
                typeof payload.adminUserId === 'string' ? payload.adminUserId : null
              ),
            },
          });

          console.log('Media asset created:', created.id);
        } catch (error) {
          console.error('Failed to save media asset:', error);
        }
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 400 }
    );
  }
}
