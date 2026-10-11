import { CustomerAccessError } from '@/lib/repositories/customer-list';

export function customerJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function customerErrorResponse(error: unknown): Response {
  return error instanceof CustomerAccessError
    ? customerJson({ code: error.code }, error.status)
    : customerJson({ code: 'customerListUnavailable' }, 503);
}