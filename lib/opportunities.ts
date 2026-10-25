import 'server-only';
import { prisma } from '@jssprz/ludo2go-database';
import {
  readSupplierStage,
  startSupplierRun,
  finishSupplierRun,
  persistSupplierMapping,
  persistSupplierApproval,
  type OpportunityRun,
  type StagedProduct,
  type SupplierStage
} from './opportunities-store';
import {
  isOpportunity,
  matchSupplierProduct,
  validateSupplierRun,
  type CatalogVariant
} from './scraping/supplier-catalog';
import {
  isAnonymousSupplier,
  readIntegration,
  SupplierError,
  SupplierSession
} from './scraping/supplier-session';
import { collectSupplierCatalog } from './scraping/supplier-adapters';
import { checkExternalStock } from './scraping/external-stock';
import {
  findInStores,
  isNewProductOpportunity,
  type CompetitorResult,
  type StoreTrace
} from './scraping/competitor-search';

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
    run.status !== 'staged' ||
    run.flags.includes('integration_changed') ||
    (run.flags.some((flag) => blockingFlags.includes(flag)) && !run.approvedAt);
  const products = run.products.map((original) => {
    let product = original;
    const match = matchSupplierProduct(product, variants, stage.mappings);
    if (match.variantId && !match.requiresReview)
      product = {
        ...product,
        external: stage.externalPool.filter(
          (item) => item.variantId === match.variantId
        )
      };
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
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    catalogVariants()
  ]);
  const runs: OpportunityRun[] = [];
  const statuses = await Promise.all(
    suppliers.map(async (supplier) => {
      let config: ReturnType<typeof readIntegration> = null;
      let status = 'integration_not_configured';
      let configured = false;
      try {
        const integration = await prisma.supplierIntegration.findUnique({
          where: { supplierId: supplier.id }
        });
        config = readIntegration(integration);
        status = config ? 'ready' : 'integration_not_configured';
        configured = Boolean(config);
        if (config) {
          const refs = isAnonymousSupplier(config)
            ? []
            : config.auth === 'browser_session'
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
        const { stage } = await readSupplierStage(supplier.id);
        const run = refreshRun(stage, variants);
        if (run) runs.push(run);
        if (
          run?.status === 'running' &&
          Date.now() - Date.parse(run.collectedAt) < 5 * 60 * 1000
        ) {
          status = 'scan_already_running';
          configured = false;
        }
      } catch (error) {
        status = databaseErrorCode(error);
        configured = false;
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

export function databaseErrorCode(error: unknown) {
  if (error instanceof SupplierError) return error.code;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  return code === 'P2021' || code === 'P2022'
    ? 'database_migration_required'
    : 'database_unavailable';
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
        storeId: link.storeId,
        variantId: link.variantId,
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

export async function scanOpportunities(supplierId: string, adminId?: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { integration: true }
  });
  if (!supplier?.isActive) throw new SupplierError('supplier_not_found');
  const config = readIntegration(supplier.integration);
  if (!config) throw new SupplierError('integration_not_configured');
  const integration = supplier.integration!;
  const reservation = await startSupplierRun(
    supplierId,
    integration.id,
    integration.configVersion,
    adminId,
    integration.updatedAt
  );
  let variants: CatalogVariant[] = [];
  const run: OpportunityRun = {
    id: reservation.id,
    supplierId,
    supplierName: supplier.name,
    collectedAt: reservation.startedAt.toISOString(),
    status: 'rejected',
    errors: [],
    flags: [],
    products: []
  };
  const deadline = Date.now() + 230000;
  try {
    const { stage } = await readSupplierStage(supplierId);
    variants = await catalogVariants();
    const products = await collectSupplierCatalog(
      supplierId,
      new SupplierSession(config)
    );
    for (const product of products) {
      product.taxTreatment = integration.taxTreatment;
      product.taxVerified =
        integration.taxTreatment !== 'unconfirmed' &&
        integration.taxVerifiedAt !== null;
    }
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
    run.status = 'failed';
  }
  await finishSupplierRun(run, integration.id, integration.configVersion);
  const { stage } = await readSupplierStage(supplierId);
  return refreshRun(stage, variants)!;
}

export async function confirmSupplierMapping(
  input: { supplierId: string; supplierProductId: string; variantId: string },
  adminId: string
) {
  await persistSupplierMapping(input, adminId);
}

export async function approveSupplierRun(
  supplierId: string,
  runId: string,
  adminId: string
) {
  await persistSupplierApproval(supplierId, runId, adminId);
}

export type NewProductCheck = {
  supplierProductId: string;
  checkedAt: string;
  stores: CompetitorResult[];
  diagnostics: StoreTrace[];
  searchedStores: number;
  opportunity: boolean;
};

// Live, unpersisted lookup of competitor stock for supplier products that are not in our catalog.
export async function checkNewProductCompetitors(
  supplierId: string,
  supplierProductIds: string[]
): Promise<NewProductCheck[]> {
  const [{ stage }, variants, stores] = await Promise.all([
    readSupplierStage(supplierId),
    catalogVariants(),
    prisma.store.findMany({
      where: { prices: { some: {} } },
      select: { id: true, name: true, url: true }
    })
  ]);
  const run = refreshRun(stage, variants);
  if (!run) throw new SupplierError('run_not_found');
  const wanted = new Set(supplierProductIds);
  const targets = run.products.filter(
    (product) =>
      wanted.has(product.supplierProductId) &&
      product.availability === 'in_stock' &&
      !product.match.variantId
  );
  const checks: NewProductCheck[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, targets.length) }, async () => {
      while (cursor < targets.length) {
        const product = targets[cursor++];
        const { results: found, traces } = await findInStores(stores, product);
        checks.push({
          supplierProductId: product.supplierProductId,
          checkedAt: new Date().toISOString(),
          stores: found,
          diagnostics: traces,
          searchedStores: stores.length,
          opportunity:
            run.status === 'staged' && isNewProductOpportunity(found)
        });
      }
    })
  );
  return checks;
}
