import { prisma } from '@jssprz/ludo2go-database';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { customerListPreferencesPayloadSchema } from '@/lib/customer-list-preferences';
import {
  CustomerListPreferencesError,
  getCustomerListPreferences,
  saveCustomerListPreferences
} from '@/lib/repositories/customer-list-preferences';

const headers = { 'Cache-Control': 'no-store' };
const MAX_BODY_LENGTH = 64 * 1024;

async function authenticatedAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new CustomerListPreferencesError('unauthorized', 401);
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { id: true }
  });
  if (!admin) throw new CustomerListPreferencesError('forbidden', 403);
  return admin.id;
}

function errorResponse(error: unknown) {
  if (error instanceof CustomerListPreferencesError) {
    return NextResponse.json(
      { code: error.code },
      { status: error.status, headers }
    );
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2021'
  ) {
    return NextResponse.json(
      { code: 'setupRequired' },
      { status: 503, headers }
    );
  }
  return NextResponse.json({ code: 'failed' }, { status: 500, headers });
}

export async function GET() {
  try {
    const adminUserId = await authenticatedAdminId();
    return NextResponse.json(await getCustomerListPreferences(adminUserId), {
      headers
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const adminUserId = await authenticatedAdminId();
    const contentType = request.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase();
    if (contentType !== 'application/json') {
      throw new CustomerListPreferencesError('invalid', 415);
    }
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    ) {
      throw new CustomerListPreferencesError('forbidden', 403);
    }
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) {
      throw new CustomerListPreferencesError('invalid', 413);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new CustomerListPreferencesError('invalid', 400);
    }
    const result = customerListPreferencesPayloadSchema.safeParse(payload);
    if (!result.success) throw new CustomerListPreferencesError('invalid', 400);
    return NextResponse.json(
      await saveCustomerListPreferences(
        adminUserId,
        result.data.preferences,
        result.data.version
      ),
      { headers }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
