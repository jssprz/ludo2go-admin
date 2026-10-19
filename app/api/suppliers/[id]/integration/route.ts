import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupplierIntegration, saveSupplierIntegration, IntegrationEditorError } from '@/lib/supplier-integration-store';
import { SupplierError } from '@/lib/scraping/supplier-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
function result(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
function failure(error: unknown) {
  if (error instanceof z.ZodError) return result({ error: 'invalid_request', fields: Array.from(new Set(error.issues.map(issue => String(issue.path[0] ?? 'config')))) }, 400);
  if (error instanceof SyntaxError || error instanceof SupplierError) return result({ error: 'invalid_request' }, 400);
  if (error instanceof IntegrationEditorError) return result({ error: error.code }, error.code === 'supplier_not_found' ? 404 : 409);
  if (error && typeof error === 'object' && 'code' in error && ['P2021', 'P2022'].includes(String(error.code)))
    return result({ error: 'database_migration_required' }, 503);
  return result({ error: 'integration_request_failed' }, 500);
}
export async function GET(_request: Request, { params }: Context) {
  if (!(await auth())?.user) return result({ error: 'unauthorized' }, 401);
  try { return result(await getSupplierIntegration((await params).id)); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: Context) {
  if (!(await auth())?.user?.id) return result({ error: 'unauthorized' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return result({ error: 'invalid_origin' }, 403);
  try {
    if (Number(request.headers.get('content-length')) > 64000) return result({ error: 'invalid_request' }, 400);
    const text = await request.text();
    if (text.length > 64000) return result({ error: 'invalid_request' }, 400);
    return result(await saveSupplierIntegration((await params).id, JSON.parse(text)));
  } catch (error) { return failure(error); }
}