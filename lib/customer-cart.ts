export type CustomerCartOwnerType = 'customer' | 'visitor';

export interface CustomerCartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | null;
  imageUrl: string | null;
}

export interface CustomerCart {
  id: string;
  status: 'active' | 'abandoned';
  updatedAt: string;
  currency: string;
  items: CustomerCartItem[];
}

export interface CustomerCartDetails {
  carts: CustomerCart[];
  hasMore: boolean;
}

export function parseCustomerCartQuery(
  params: URLSearchParams
): { type: CustomerCartOwnerType; id: string } | null {
  if (params.getAll('type').length !== 1 || params.getAll('id').length !== 1)
    return null;
  const type = params.get('type');
  const id = params.get('id');
  if (type !== 'customer' && type !== 'visitor') return null;
  if (!id || id.length > 200 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { type, id };
}
