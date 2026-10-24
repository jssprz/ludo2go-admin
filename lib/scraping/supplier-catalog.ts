export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';
export type TaxTreatment = 'unconfirmed' | 'vat_included' | 'excluding_vat';
export type SupplierKind = 'asmodee' | 'devir' | 'lanae';

export type SupplierProduct = {
  supplierId: string;
  supplierProductId: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  url: string;
  categories: string[];
  availability: Availability;
  purchasePrice: number | null;
  currency: 'CLP';
  taxTreatment: TaxTreatment;
  taxVerified: boolean;
  packQuantity: number | null;
  edition: string | null;
  language: string | null;
  expansion: boolean | null;
  collectedAt: string;
};

export type CatalogVariant = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
};

export type SupplierMapping = {
  supplierProductId: string;
  variantId: string;
  reviewed: boolean;
  identityFingerprint?: string;
};

export type ProductMatch = {
  variantId: string | null;
  method: 'mapping' | 'barcode' | 'sku' | 'name_proposal' | 'none';
  requiresReview: boolean;
};

export function parseClp(
  value: string | number | null | undefined
): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? value : null;
  if (!value?.trim()) return null;
  const normalized = value
    .replace(/CLP|\$|\s/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function nameKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// EAN-13, UPC-A and GTIN-14 encode the same code with different zero padding.
function eanKey(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 8 ? digits : '';
}

function skuKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function supplierProductIdentity(product: SupplierProduct) {
  return JSON.stringify([
    product.supplierProductId,
    product.sku,
    product.barcode,
    product.name,
    product.url,
    product.edition,
    product.language,
    product.expansion,
    product.packQuantity
  ]);
}

export function matchSupplierProduct(
  product: SupplierProduct,
  variants: CatalogVariant[],
  mappings: SupplierMapping[]
): ProductMatch {
  const mapping = mappings.find(
    (item) => item.supplierProductId === product.supplierProductId
  );
  if (mapping && variants.some((variant) => variant.id === mapping.variantId)) {
    return {
      variantId: mapping.variantId,
      method: 'mapping',
      requiresReview: false
    };
  }
  const barcode = eanKey(product.barcode);
  if (barcode) {
    const matches = variants.filter(
      (variant) => eanKey(variant.barcode) === barcode
    );
    if (matches.length === 1) {
      return { variantId: matches[0].id, method: 'barcode', requiresReview: false };
    }
  }
  const sku = skuKey(product.sku);
  if (sku) {
    const matches = variants.filter((variant) => skuKey(variant.sku) === sku);
    if (matches.length === 1) {
      return { variantId: matches[0].id, method: 'sku', requiresReview: false };
    }
  }
  const proposals = variants.filter(
    (variant) => nameKey(variant.name) === nameKey(product.name)
  );
  return proposals.length === 1
    ? {
        variantId: proposals[0].id,
        method: 'name_proposal',
        requiresReview: true
      }
    : { variantId: null, method: 'none', requiresReview: true };
}

export function validateSupplierRun(input: {
  authenticated: boolean;
  complete: boolean;
  products: SupplierProduct[];
  previous?: SupplierProduct[];
}) {
  const errors: string[] = [];
  const flags: string[] = [];
  if (!input.authenticated) errors.push('authentication_not_verified');
  if (!input.complete) errors.push('incomplete_catalog');
  if (!input.products.length) errors.push('empty_catalog');
  const identifiers = new Set<string>();
  for (const product of input.products) {
    if (
      !product.supplierProductId ||
      !product.name ||
      !product.url ||
      !product.collectedAt
    ) {
      errors.push('invalid_product');
    }
    if (identifiers.has(product.supplierProductId))
      errors.push('duplicate_product');
    identifiers.add(product.supplierProductId);
    if (
      product.purchasePrice !== null &&
      (!Number.isFinite(product.purchasePrice) || product.purchasePrice < 0)
    ) {
      errors.push('invalid_price');
    }
    if (
      product.packQuantity !== null &&
      (!Number.isInteger(product.packQuantity) || product.packQuantity < 1)
    ) {
      errors.push('invalid_pack_quantity');
    }
  }
  if (input.products.some((product) => product.purchasePrice === null))
    flags.push('missing_prices');
  if (input.products.some((product) => !product.taxVerified))
    flags.push('tax_unverified');
  if (input.previous?.length) {
    if (Math.abs(input.products.length / input.previous.length - 1) > 0.25)
      flags.push('product_count_changed');
    const previousById = new Map(
      input.previous.map((product) => [product.supplierProductId, product])
    );
    for (const product of input.products) {
      const before = previousById.get(product.supplierProductId)?.purchasePrice;
      if (
        before != null &&
        before > 0 &&
        product.purchasePrice !== null &&
        Math.abs(product.purchasePrice / before - 1) > 0.3
      ) {
        flags.push('price_changed');
        break;
      }
    }
  }
  return {
    accepted: errors.length === 0,
    errors: Array.from(new Set(errors)),
    flags
  };
}

export function isOpportunity(
  product: SupplierProduct,
  match: ProductMatch,
  external: Availability[]
) {
  return (
    product.availability === 'in_stock' &&
    match.variantId !== null &&
    !match.requiresReview &&
    external.length > 0 &&
    external.every((availability) => availability === 'out_of_stock')
  );
}
