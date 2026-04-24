import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

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
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Determine media kind from content type
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

        const payload = tokenPayload ? JSON.parse(tokenPayload) : {};

        const sizeBytes = typeof payload.sizeBytes === 'number' ? payload.sizeBytes : null;

        await prisma.mediaAsset.create({
          data: {
            kind,
            url: blob.url,
            thumbUrl: kind === 'image' ? blob.url : null,
            width: null,
            height: null,
            sizeBytes: sizeBytes,
            mime: blob.contentType || payload.mime || 'application/octet-stream',
            locale: null,
            alt,
            copyright: null,
          },
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 400 }
    );
  }
}
