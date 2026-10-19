import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  approveSupplierRun,
  confirmSupplierMapping,
  getOpportunities,
  scanOpportunities
} from '@/lib/opportunities';
import { SupplierError } from '@/lib/scraping/supplier-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function result(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}
function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return result({ error: 'invalid_request' }, 400);
  return result(
    {
      error:
        error instanceof SupplierError
          ? error.code
          : 'opportunities_request_failed'
    },
    400
  );
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return result({ error: 'Unauthorized' }, 401);
  try {
    return result(await getOpportunities());
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return result({ error: 'Unauthorized' }, 401);
  if (!sameOrigin(request)) return result({ error: 'invalid_origin' }, 403);
  try {
    const { supplierId } = z
      .object({ supplierId: z.string().min(1).max(100) })
      .strict()
      .parse(await request.json());
    return result({ run: await scanOpportunities(supplierId) });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return result({ error: 'Unauthorized' }, 401);
  if (!sameOrigin(request)) return result({ error: 'invalid_origin' }, 403);
  try {
    const body = z
      .union([
        z
          .object({
            supplierId: z.string().min(1).max(100),
            supplierProductId: z.string().min(1).max(200),
            variantId: z.string().min(1).max(100),
            reviewed: z.literal(true)
          })
          .strict(),
        z
          .object({
            supplierId: z.string().min(1).max(100),
            runId: z.string().uuid(),
            approve: z.literal(true)
          })
          .strict()
      ])
      .parse(await request.json());
    if ('approve' in body)
      await approveSupplierRun(body.supplierId, body.runId, session.user.id);
    else await confirmSupplierMapping(body, session.user.id);
    return result({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
