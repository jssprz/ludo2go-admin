import { parseVisitorEventsQuery } from '@/lib/visitor-events';
import { getVisitorEventDetails } from '@/lib/repositories/visitor-events';
import {
  CustomerAccessError,
  requireCustomerAdmin
} from '@/lib/repositories/customer-list';
import { customerJson } from '../duplicates/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireCustomerAdmin();
    const input = parseVisitorEventsQuery(new URL(request.url).searchParams);
    if (!input) return customerJson({ code: 'invalidRequest' }, 400);
    const details = await getVisitorEventDetails(input.id);
    if (!details) return customerJson({ code: 'notFound' }, 404);
    return customerJson(details);
  } catch (error) {
    if (
      error instanceof CustomerAccessError &&
      (error.status === 401 || error.status === 403)
    ) {
      return customerJson(
        { code: error.status === 401 ? 'unauthorized' : 'forbidden' },
        error.status
      );
    }
    return customerJson({ code: 'visitorEventsUnavailable' }, 503);
  }
}
