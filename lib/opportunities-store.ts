import 'server-only';
import { get, put } from '@vercel/blob';
import type {
  Availability,
  ProductMatch,
  SupplierMapping,
  SupplierProduct
} from './scraping/supplier-catalog';
import { SupplierError } from './scraping/supplier-session';

export type ExternalObservation = {
  storeName: string;
  url: string;
  availability: Availability;
  checkedAt: string;
};
export type StagedProduct = SupplierProduct & {
  match: ProductMatch;
  external: ExternalObservation[];
  opportunity: boolean;
};
export type OpportunityRun = {
  id: string;
  supplierId: string;
  supplierName: string;
  collectedAt: string;
  status: 'staged' | 'rejected';
  errors: string[];
  flags: string[];
  products: StagedProduct[];
  approvedBy?: string;
  approvedAt?: string;
};
export type SupplierStage = {
  version: 1;
  supplierId: string;
  mappings: (SupplierMapping & { reviewedAt: string; reviewedBy: string })[];
  run: OpportunityRun | null;
  baseline: SupplierProduct[];
};

function options() {
  const token = process.env.SUPPLIER_STAGE_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new SupplierError('private_staging_not_configured');
  return { token, access: 'private' as const };
}
function pathname(supplierId: string) {
  return `opportunities/v1/${encodeURIComponent(supplierId)}/stage.json`;
}
export async function readSupplierStage(supplierId: string) {
  const response = await get(pathname(supplierId), {
    ...options(),
    useCache: false
  });
  if (!response)
    return {
      stage: {
        version: 1,
        supplierId,
        mappings: [],
        run: null,
        baseline: []
      } as SupplierStage,
      etag: undefined
    };
  if (response.statusCode !== 200)
    throw new SupplierError('private_staging_read_failed');
  const stage = (await new Response(response.stream).json()) as SupplierStage;
  if (
    stage.version !== 1 ||
    stage.supplierId !== supplierId ||
    !Array.isArray(stage.mappings) ||
    !Array.isArray(stage.baseline)
  ) {
    throw new SupplierError('private_staging_invalid');
  }
  return { stage, etag: response.blob.etag };
}
export async function writeSupplierStage(stage: SupplierStage, etag?: string) {
  try {
    await put(pathname(stage.supplierId), JSON.stringify(stage), {
      ...options(),
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      ...(etag ? { ifMatch: etag } : {})
    });
  } catch {
    throw new SupplierError('staging_conflict_or_write_failed');
  }
}
