import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { del, get, put } from '@vercel/blob';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import {
  DELIVERY_PROOF_MAX_BYTES,
  DELIVERY_PROOF_TYPES,
  appendDeliveryProof,
  deliveryRecipientSchema,
  setDeliveryRecipient,
  updateDeliveredMetadata,
  type DeliveryRecipient,
  deliveryProofPrefix,
  isDeliveryProofPathname,
  sensitiveBlobAuth,
  type DeliveryProof,
} from '@/lib/delivery-proof';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Expected multipart form data.' }, { status: 400 });
  }
  const photo = form.get('photo');
  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ message: 'A photo is required.' }, { status: 400 });
  }
  const extension = DELIVERY_PROOF_TYPES[photo.type];
  if (!extension) return NextResponse.json({ message: 'Unsupported image type.' }, { status: 400 });
  if (photo.size > DELIVERY_PROOF_MAX_BYTES) {
    return NextResponse.json({ message: 'Photo is too large (max 4 MB).' }, { status: 413 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  if (order.status !== 'delivered') {
    return NextResponse.json({ message: 'Delivery photos can only be added to delivered orders.' }, { status: 400 });
  }

  let blobAuth: Awaited<ReturnType<typeof sensitiveBlobAuth>>;
  try {
    blobAuth = await sensitiveBlobAuth();
  } catch (error) {
    console.error('Delivery proof storage unavailable:', error);
    return NextResponse.json({ message: 'Private photo storage is not configured.' }, { status: 503 });
  }

  const pathname = `${deliveryProofPrefix(id)}${Date.now()}-${randomUUID()}.${extension}`;
  const uploaded = await put(pathname, photo, {
    access: 'private',
    contentType: photo.type,
    addRandomSuffix: false,
    ...blobAuth,
  });

  const proof: DeliveryProof = {
    pathname: uploaded.pathname,
    contentType: photo.type,
    size: photo.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: typeof session.user.id === 'string' ? session.user.id : null,
  };

  try {
    await prisma.$transaction((tx) =>
      updateDeliveredMetadata(tx, id, proof.uploadedBy, (metadata) => appendDeliveryProof(metadata, proof))
    );
  } catch (error) {
    await del(uploaded.url, blobAuth).catch(() => undefined);
    throw error;
  }

  return NextResponse.json(proof, { status: 201 });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = deliveryRecipientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  if (order.status !== 'delivered') {
    return NextResponse.json({ message: 'The recipient can only be recorded for delivered orders.' }, { status: 400 });
  }

  const recipient: DeliveryRecipient = {
    ...parsed.data,
    recordedAt: new Date().toISOString(),
    recordedBy: typeof session.user.id === 'string' ? session.user.id : null,
  };
  await prisma.$transaction((tx) =>
    updateDeliveredMetadata(tx, id, recipient.recordedBy, (metadata) => setDeliveryRecipient(metadata, recipient))
  );
  return NextResponse.json(recipient);
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const pathname = new URL(request.url).searchParams.get('pathname') ?? '';
  if (!isDeliveryProofPathname(id, pathname)) {
    return NextResponse.json({ message: 'Invalid photo path.' }, { status: 400 });
  }

  let blobAuth: Awaited<ReturnType<typeof sensitiveBlobAuth>>;
  try {
    blobAuth = await sensitiveBlobAuth();
  } catch (error) {
    console.error('Delivery proof storage unavailable:', error);
    return NextResponse.json({ message: 'Private photo storage is not configured.' }, { status: 503 });
  }

  const result = await get(pathname, { access: 'private', ...blobAuth });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ message: 'Photo not found.' }, { status: 404 });
  }
  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
