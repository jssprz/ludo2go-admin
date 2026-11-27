import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auth } from './auth';
import { EmailTemplateError } from './email-template-rendering';

export function emailTemplateResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

export async function authorizeEmailTemplates(
  request: Request,
  mutation = false
) {
  if (!(await auth())?.user?.id)
    return emailTemplateResponse({ error: 'unauthorized' }, 401);
  if (mutation) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return emailTemplateResponse({ error: 'invalid_origin' }, 403);
  }
  return null;
}

export async function readEmailTemplateBody(
  request: Request
): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > 400000)
    throw new EmailTemplateError('invalid_request');
  const text = await request.text();
  if (text.length > 400000) throw new EmailTemplateError('invalid_request');
  return JSON.parse(text);
}

export function emailTemplateFailure(error: unknown) {
  if (error instanceof z.ZodError)
    return emailTemplateResponse(
      {
        error: 'invalid_request',
        detail: error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      },
      400
    );
  if (error instanceof SyntaxError)
    return emailTemplateResponse({ error: 'invalid_json' }, 400);
  if (error instanceof EmailTemplateError)
    return emailTemplateResponse(
      { error: error.code, detail: error.detail?.slice(0, 1000) },
      400
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      return emailTemplateResponse({ error: 'duplicate' }, 409);
    if (error.code === 'P2025')
      return emailTemplateResponse({ error: 'not_found' }, 404);
    if (['P2021', 'P2022'].includes(error.code))
      return emailTemplateResponse({ error: 'migration_required' }, 503);
  }
  console.error('Email template operation failed.');
  return emailTemplateResponse({ error: 'request_failed' }, 500);
}
