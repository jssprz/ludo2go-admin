import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { checkNewProductCompetitors } from '@/lib/opportunities';
import { SupplierError } from '@/lib/scraping/supplier-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function result(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return result({ error: 'Unauthorized' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return result({ error: 'invalid_origin' }, 403);
  try {
    const { supplierId, supplierProductIds } = z
      .object({
        supplierId: z.string().min(1).max(100),
        supplierProductIds: z.array(z.string().min(1).max(200)).min(1).max(10)
      })
      .strict()
      .parse(await request.json());
    return result({
      checks: await checkNewProductCompetitors(
        supplierId,
        Array.from(new Set(supplierProductIds))
      )
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return result({ error: 'invalid_request' }, 400);
    console.error('[api/opportunities/competitors] request failed');
    return result(
      {
        error:
          error instanceof SupplierError
            ? error.code
            : 'opportunities_request_failed'
      },
      error instanceof SupplierError ? 400 : 500
    );
  }
}
