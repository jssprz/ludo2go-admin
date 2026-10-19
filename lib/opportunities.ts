import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@jssprz/ludo2go-database';
import {
  readSupplierStage,
  writeSupplierStage,
  type OpportunityRun,
  type StagedProduct,
  type SupplierStage
} from './opportunities-store';
import {
  isOpportunity,
  matchSupplierProduct,
  supplierProductIdentity,
  validateSupplierRun,
  type CatalogVariant
} from './scraping/supplier-catalog';
import {
  readIntegration,
  SupplierError,
  SupplierSession
} from './scraping/supplier-session';
import { collectSupplierCatalog } from './scraping/supplier-adapters';
import { checkExternalStock } from './scraping/external-stock';

const freshForMs = 60 * 60 * 1000;
const blockingFlags = [
  'price_changed',
  'product_count_changed',
  'baseline_review_required'
];

function refreshRun(stage: SupplierStage, variants: CatalogVariant[]) {
  const run = stage.run;
  if (!run) return null;
  const blocked =
    run.status === 'rejected' ||
    (run.flags.some((flag) => blockingFlags.includes(flag)) && !run.approvedAt);
  const products = run.products.map((product) => {
    const match = matchSupplierProduct(product, variants, stage.mappings);
    const fresh =
      Date.now() - Date.parse(product.collectedAt) < freshForMs &&
      product.external.every(
        (item) => Date.now() - Date.parse(item.checkedAt) < freshForMs
      );
    return {
      ...product,
      match,
      opportunity:
        !blocked &&
        fresh &&
        isOpportunity(
          product,
          match,
          product.external.map((item) => item.availability)
        )
    };
  });
  return { ...run, products };
}

async function catalogVariants() {
  const variants = await prisma.productVariant.findMany({
    select: {
      id: true,
      sku: true,
      eanUpc: true,
      product: { select: { name: true } }
    }
  });
  return variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    barcode: variant.eanUpc,
    name: variant.product.name
  }));
}

export async function getOpportunities() {
  const [suppliers, variants] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, notes: true, website: true },
      orderBy: { name: 'asc' }
    }),
    catalogVariants()
  ]);
  const storageReady = Boolean(
    process.env.SUPPLIER_STAGE_BLOB_READ_WRITE_TOKEN
  );
  const runs: OpportunityRun[] = [];
  const statuses = await Promise.all(
    suppliers.map(async (supplier) => {
      const config = readIntegration(supplier.notes);
      let status = config ? 'ready' : 'integration_not_configured';
      let configured = Boolean(config) && storageReady;
      if (config) {
        const refs =
          config.auth === 'browser_session'
            ? [config.secrets.session]
            : [config.secrets.username, config.secrets.password];
        if (refs.some((ref) => !ref || !process.env[ref])) {
          status = 'secret_not_configured';
          configured = false;
        }
        if (config.kind === 'asmodee' && !config.catalog.structured) {
          status = 'authenticated_catalog_request_not_configured';
          configured = false;
        }
        if (
          config.browserRendering &&
          (!config.secrets.browser || !process.env[config.secrets.browser])
        ) {
          status = 'browser_renderer_not_configured';
          configured = false;
        }
      }
      if (!storageReady) status = 'private_staging_not_configured';
      else {
        try {
          const { stage } = await readSupplierStage(supplier.id);
          const run = refreshRun(stage, variants);
          if (run) runs.push(run);
        } catch {
          status = 'private_staging_read_failed';
          configured = false;
        }
      }
      return {
        id: supplier.id,
        name: supplier.name,
        kind: config?.kind ?? null,
        configured,
        status
      };
    })
  );
  return {
    suppliers: statuses,
    variants: variants.map(({ id, sku, name }) => ({ id, sku, name })),
    runs
  };
}

async function externalObservations(
  products: StagedProduct[],
  deadline: number,
  variants: CatalogVariant[]
) {
  const ids = Array.from(
    new Set(
      products
        .filter(
          (product) => product.match.variantId && !product.match.requiresReview
        )
        .map((product) => product.match.variantId!)
    )
  );
  if (!ids.length) return false;
  const links = await prisma.itemPriceInStore.findMany({
    where: { variantId: { in: ids } },
    orderBy: { observedAt: 'desc' },
    select: {
      variantId: true,
      storeId: true,
      urlPathInStore: true,
      store: { select: { name: true, url: true } }
    }
  });
  const seen = new Set<string>();
  const jobs: {
    url: string;
    variantId: string;
    observation: StagedProduct['external'][number];
  }[] = [];
  for (const link of links) {
    const key = `${link.variantId}:${link.storeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let url = '';
    try {
      const base = new URL(link.store.url);
      const parsed = new URL(link.urlPathInStore, base);
      if (base.origin === parsed.origin) url = parsed.href;
    } catch {}
    jobs.push({
      url,
      variantId: link.variantId,
      observation: {
        storeName: link.store.name,
        url,
        availability: 'unknown',
        checkedAt: new Date().toISOString()
      }
    });
  }
  let cursor = 0;
  let incomplete = false;
  const results = new Map<
    string,
    Awaited<ReturnType<typeof checkExternalStock>>
  >();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < jobs.length) {
        const index = cursor++;
        const job = jobs[index];
        if (index >= 200 || Date.now() > deadline) {
          incomplete = true;
          continue;
        }
        if (job.url) {
          const variant = variants.find((item) => item.id === job.variantId);
          const key = `${job.url}:${job.variantId}`;
          const cached = results.get(key);
          job.observation.availability = variant
            ? (cached ?? (await checkExternalStock(job.url, variant)))
            : 'unknown';
          results.set(key, job.observation.availability);
        }
        job.observation.checkedAt = new Date().toISOString();
      }
    })
  );
  for (const product of products)
    product.external = jobs
      .filter((job) => job.variantId === product.match.variantId)
      .map((job) => job.observation);
  return incomplete;
}

export async function scanOpportunities(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId }
  });
  if (!supplier?.isActive) throw new SupplierError('supplier_not_found');
  const config = readIntegration(supplier.notes);
  if (!config) throw new SupplierError('integration_not_configured');
  const { stage, etag } = await readSupplierStage(supplierId);
  const variants = await catalogVariants();
  const run: OpportunityRun = {
    id: randomUUID(),
    supplierId,
    supplierName: supplier.name,
    collectedAt: new Date().toISOString(),
    status: 'rejected',
    errors: [],
    flags: [],
    products: []
  };
  const deadline = Date.now() + 230000;
  try {
    const products = await collectSupplierCatalog(
      supplierId,
      new SupplierSession(config)
    );
    const validation = validateSupplierRun({
      authenticated: true,
      complete: true,
      products,
      previous: stage.baseline
    });
    run.errors = validation.errors;
    run.flags = validation.flags;
    if (!stage.baseline.length) run.flags.push('baseline_review_required');
    run.status = validation.accepted ? 'staged' : 'rejected';
    run.products = products.map((product) => ({
      ...product,
      match: matchSupplierProduct(product, variants, stage.mappings),
      external: [],
      opportunity: false
    }));
    if (await externalObservations(run.products, deadline, variants))
      run.flags.push('external_checks_incomplete');
  } catch (error) {
    run.errors = [
      error instanceof SupplierError ? error.code : 'supplier_scan_failed'
    ];
    run.products = [];
    run.status = 'rejected';
  }
  stage.run = run;
  await writeSupplierStage(stage, etag);
  return refreshRun(stage, variants)!;
}

export async function confirmSupplierMapping(
  input: { supplierId: string; supplierProductId: string; variantId: string },
  adminId: string
) {
  const [{ stage, etag }, variant] = await Promise.all([
    readSupplierStage(input.supplierId),
    prisma.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true }
    })
  ]);
  if (
    !variant ||
    stage.run?.status !== 'staged' ||
    !stage.run.products.some(
      (product) => product.supplierProductId === input.supplierProductId
    )
  ) {
    throw new SupplierError('mapping_target_not_found');
  }
  stage.mappings = stage.mappings.filter(
    (mapping) => mapping.supplierProductId !== input.supplierProductId
  );
  const productToReview = stage.run.products.find(
    (product) => product.supplierProductId === input.supplierProductId
  )!;
  stage.mappings.push({
    supplierProductId: input.supplierProductId,
    variantId: input.variantId,
    reviewed: true,
    identityFingerprint: supplierProductIdentity(productToReview),
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminId
  });
  for (const product of stage.run.products) {
    if (product.supplierProductId === input.supplierProductId) {
      product.external = [];
      product.opportunity = false;
    }
  }
  await writeSupplierStage(stage, etag);
}

export async function approveSupplierRun(
  supplierId: string,
  runId: string,
  adminId: string
) {
  const { stage, etag } = await readSupplierStage(supplierId);
  if (
    stage.run?.id !== runId ||
    stage.run.status !== 'staged' ||
    stage.run.errors.length
  )
    throw new SupplierError('run_not_approvable');
  stage.run.approvedAt = new Date().toISOString();
  stage.run.approvedBy = adminId;
  stage.baseline = stage.run.products.map(
    ({ match, external, opportunity, ...product }) => product
  );
  await writeSupplierStage(stage, etag);
}
