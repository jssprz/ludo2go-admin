import { parseCustomerCartQuery } from '@/lib/customer-cart';
import { getCustomerCartDetails } from '@/lib/repositories/customer-cart';
import {
  CustomerAccessError,
  requireCustomerAdmin
} from '@/lib/repositories/customer-list';
import { customerJson } from '../duplicates/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireCustomerAdmin();
    const input = parseCustomerCartQuery(new URL(request.url).searchParams);
    if (!input) return customerJson({ code: 'invalidRequest' }, 400);
    const details = await getCustomerCartDetails(input.type, input.id);
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
    return customerJson({ code: 'customerCartUnavailable' }, 503);
  }
}
