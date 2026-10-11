import { parseCustomerListReviewIds } from '@/lib/customer-list';
import { getCustomerDuplicateReview, requireCustomerAdmin } from '@/lib/repositories/customer-list';
import { customerJson, customerErrorResponse } from '../http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireCustomerAdmin();
    const ids = parseCustomerListReviewIds(new URL(request.url).searchParams);
    if (!ids) return customerJson({ code: 'invalid' }, 400);
    const review = await getCustomerDuplicateReview(ids.customerId, ids.candidateId);
    return review ? customerJson(review) : customerJson({ code: 'duplicateNotFound' }, 404);
  } catch (error) {
    return customerErrorResponse(error);
  }
}

export async function POST(): Promise<Response> {
  try {
    await requireCustomerAdmin();
    return customerJson({ code: 'mergeBlocked', mergeAllowed: false, reviewPersisted: false }, 409);
  } catch (error) {
    return customerErrorResponse(error);
  }
}