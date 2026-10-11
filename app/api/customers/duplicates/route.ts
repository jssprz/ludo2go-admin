import { parseCustomerListQuery } from '@/lib/customer-list';
import { getCustomerDuplicateCandidates, requireCustomerAdmin } from '@/lib/repositories/customer-list';
import { customerJson, customerErrorResponse } from './http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireCustomerAdmin();
    const input = parseCustomerListQuery(new URL(request.url).searchParams);
    return customerJson(await getCustomerDuplicateCandidates(input));
  } catch (error) {
    return customerErrorResponse(error);
  }
}