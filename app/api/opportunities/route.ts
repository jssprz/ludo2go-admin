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
function databaseFailureCode(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (code === 'P2021' || code === 'P2022') return 'database_migration_required';
  if (
    name === 'PrismaClientInitializationError' ||
    name === 'PrismaClientRustPanicError' ||
    /^P10(?:0\d|1[0-7])$/.test(code) ||
    ['P2010', 'P2024', 'P2028', 'P2037'].includes(code)
  ) return 'database_unavailable';
  return null;
}

function failure(error: unknown, operation: 'GET' | 'POST' | 'PATCH') {
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return result({ error: 'invalid_request' }, 400);
  const databaseError = databaseFailureCode(error);
  const name = error && typeof error === 'object' && 'name' in error && typeof error.name === 'string'
    ? error.name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64)
    : 'UnknownError';
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z]\d{4}$/.test(error.code)
    ? error.code
    : null;
  console.error('[api/opportunities] request failed', { operation, name, code });
  if (databaseError) {
    return result({ error: databaseError }, 503);
  }
  return result(
    {
      error:
        error instanceof SupplierError
          ? error.code
          : error &&
              typeof error === 'object' &&
              'code' in error &&
              ['P2021', 'P2022'].includes(String(error.code))
            ? 'database_migration_required'
            : 'opportunities_request_failed'
    },
    error instanceof SupplierError &&
      [
        'scan_already_running',
        'scan_superseded',
        'integration_changed'
      ].includes(error.code)
      ? 409
      : error &&
          typeof error === 'object' &&
          'code' in error &&
          ['P2021', 'P2022'].includes(String(error.code))
        ? 503
        : 400
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
    return failure(error, 'GET');
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return result({ error: 'Unauthorized' }, 401);
  if (!sameOrigin(request)) return result({ error: 'invalid_origin' }, 403);
  try {
    const { supplierId } = z
      .object({ supplierId: z.string().min(1).max(100) })
      .strict()
      .parse(await request.json());
    return result({
      run: await scanOpportunities(supplierId, session.user.id)
    });
  } catch (error) {
    return failure(error, 'POST');
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
    return failure(error, 'PATCH');
  }
}
