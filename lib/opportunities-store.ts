import 'server-only';
import { prisma } from '@jssprz/ludo2go-database';
import type { Prisma } from '@prisma/client';
import type {
  Availability,
  ProductMatch,
  SupplierMapping,
  SupplierProduct
} from './scraping/supplier-catalog';
import { SupplierError } from './scraping/supplier-session';
import { supplierProductIdentity } from './scraping/supplier-catalog';
export type ExternalObservation = {
  storeName: string;
  storeId: string;
  variantId: string;
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
  status: 'running' | 'staged' | 'rejected' | 'failed';
  errors: string[];
  flags: string[];
  products: StagedProduct[];
  approvedBy?: string;
  approvedAt?: string;
};
export type SupplierStage = {
  supplierId: string;
  mappings: SupplierMapping[];
  run: OpportunityRun | null;
  baseline: SupplierProduct[];
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

const runInclude = {
  observations: { include: { supplierCatalogProduct: true } },
  externalStockObservations: { include: { store: { select: { name: true } } } }
} satisfies Prisma.SupplierCatalogRunInclude;
type StoredRun = Prisma.SupplierCatalogRunGetPayload<{
  include: typeof runInclude;
}>;
type StoredObservation = StoredRun['observations'][number];

function productFromRow(
  row: StoredObservation,
  supplierId: string
): SupplierProduct {
  return {
    supplierId,
    supplierProductId: row.supplierCatalogProduct.supplierProductId,
    name: row.name,
    url: row.url,
    sku: row.sku,
    barcode: row.barcode,
    categories: row.categories,
    availability: row.availability,
    purchasePrice:
      row.purchasePrice === null ? null : Number(row.purchasePrice),
    currency: 'CLP',
    taxTreatment: row.taxTreatment,
    taxVerified:
      row.taxVerifiedAt !== null && row.taxTreatment !== 'unconfirmed',
    packQuantity: row.packQuantity,
    edition: row.edition,
    language: row.language,
    expansion: row.expansion,
    collectedAt: row.collectedAt.toISOString()
  };
}

export async function readSupplierStage(
  supplierId: string
): Promise<{ stage: SupplierStage }> {
  return supplierTransaction(supplierId, async (tx) => {
    const integration = await tx.supplierIntegration.findUnique({
      where: { supplierId },
      include: { supplier: { select: { name: true } }, products: true }
    });
    const stage: SupplierStage = {
      supplierId,
      mappings: [],
      run: null,
      baseline: []
    };
    if (!integration) return { stage };
    const [run, baseline] = await Promise.all([
      tx.supplierCatalogRun.findFirst({
        where: { integrationId: integration.id },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        include: runInclude
      }),
      tx.supplierCatalogRun.findFirst({
        where: {
          integrationId: integration.id,
          configVersion: integration.configVersion,
          status: 'staged',
          approvedAt: { not: null }
        },
        orderBy: { approvedAt: 'desc' },
        include: runInclude
      })
    ]);
    stage.mappings = integration.products
      .filter((product) => product.variantId)
      .map((product) => ({
        supplierProductId: product.supplierProductId,
        variantId: product.variantId!,
        reviewed: product.mappingStatus === 'confirmed',
        identityFingerprint: product.reviewedIdentityFingerprint ?? undefined
      }));
    stage.baseline =
      baseline?.observations.map((row) => productFromRow(row, supplierId)) ??
      [];
    if (run)
      stage.run = {
        id: run.id,
        supplierId,
        supplierName: integration.supplier.name,
        collectedAt: run.startedAt.toISOString(),
        status: run.status,
        errors: run.errors,
        flags: [
          ...run.flags,
          ...(run.configVersion !== integration.configVersion ||
          integration.updatedAt > run.startedAt ||
          !integration.isEnabled
            ? ['integration_changed']
            : [])
        ],
        approvedAt: run.approvedAt?.toISOString(),
        approvedBy: run.approvedByAdminUserId ?? undefined,
        products: run.observations.map((row) => {
          const mapping = row.supplierCatalogProduct;
          const reviewed =
            mapping.mappingStatus === 'confirmed' &&
            mapping.reviewedIdentityFingerprint === row.identityFingerprint;
          return {
            ...productFromRow(row, supplierId),
            match: { variantId: null, method: 'none', requiresReview: true },
            opportunity: false,
            external: reviewed
              ? run.externalStockObservations
                  .filter(
                    (external) =>
                      external.variantId === mapping.variantId &&
                      mapping.reviewedAt &&
                      external.checkedAt >= mapping.reviewedAt
                  )
                  .map((external) => ({
                    storeId: external.storeId,
                    variantId: external.variantId,
                    storeName: external.store.name,
                    url: external.requestedUrl,
                    availability:
                      external.expiresAt > new Date() &&
                      external.status === 'checked' &&
                      external.identityVerified
                        ? external.availability
                        : 'unknown',
                    checkedAt: external.checkedAt.toISOString()
                  }))
              : []
          };
        })
      };
    return { stage };
  });
}

export function supplierTransaction<Result>(
  supplierId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<Result>,
  timeout = 20000
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`WITH advisory_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${supplierId}, 0))) SELECT 1 AS locked FROM advisory_lock`;
      return operation(tx);
    },
    { timeout }
  );
}

export async function startSupplierRun(
  supplierId: string,
  integrationId: string,
  configVersion: number,
  requestedByAdminUserId?: string,
  configUpdatedAt?: Date
) {
  return supplierTransaction(supplierId, async (tx) => {
    const integration = await tx.supplierIntegration.findUnique({
      where: { id: integrationId }
    });
    if (
      !integration?.isEnabled ||
      integration.configVersion !== configVersion ||
      (configUpdatedAt &&
        integration.updatedAt.getTime() !== configUpdatedAt.getTime())
    )
      throw new SupplierError('integration_changed');
    const running = await tx.supplierCatalogRun.findFirst({
      where: { integrationId, status: 'running' }
    });
    if (running && Date.now() - running.startedAt.getTime() < 5 * 60 * 1000)
      throw new SupplierError('scan_already_running');
    await tx.supplierCatalogRun.updateMany({
      where: { integrationId, status: 'running' },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: ['scan_lease_expired']
      }
    });
    const baseline = await tx.supplierCatalogRun.findFirst({
      where: {
        integrationId,
        configVersion,
        status: 'staged',
        approvedAt: { not: null }
      },
      orderBy: { approvedAt: 'desc' }
    });
    return tx.supplierCatalogRun.create({
      data: {
        integrationId,
        configVersion,
        status: 'running',
        baselineRunId: baseline?.id,
        requestedByAdminUserId
      }
    });
  });
}

export async function finishSupplierRun(
  run: OpportunityRun,
  integrationId: string,
  configVersion: number
) {
  return supplierTransaction(run.supplierId, async (tx) => {
    const stored = await tx.supplierCatalogRun.findUnique({
      where: { id: run.id }
    });
    const integration = await tx.supplierIntegration.findUnique({
      where: { id: integrationId }
    });
    if (!stored || stored.status !== 'running')
      throw new SupplierError('scan_superseded');
    if (
      !integration?.isEnabled ||
      integration.configVersion !== configVersion ||
      integration.updatedAt > stored.startedAt
    ) {
      await tx.supplierCatalogRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errors: ['integration_changed']
        }
      });
      return;
    }
    if (run.status === 'staged') {
      const productIds = run.products.map((product) => product.supplierProductId);
      const previousProducts = await tx.supplierCatalogProduct.findMany({
        where: {
          integrationId,
          supplierProductId: { in: productIds }
        }
      });
      const previousBySupplierId = new Map(
        previousProducts.map((product) => [product.supplierProductId, product])
      );
      const collectedDates = run.products.map((product) => new Date(product.collectedAt));
      await tx.supplierCatalogProduct.createMany({
        data: run.products.map((product) => ({
          integrationId,
          supplierProductId: product.supplierProductId,
          firstSeenAt: new Date(product.collectedAt),
          lastSeenAt: new Date(product.collectedAt)
        })),
        skipDuplicates: true
      });
      await tx.supplierCatalogProduct.updateMany({
        where: { integrationId, supplierProductId: { in: productIds } },
        data: { lastSeenAt: new Date(Math.max(...collectedDates.map((date) => date.getTime()))) }
      });
      const catalogProducts = await tx.supplierCatalogProduct.findMany({
        where: { integrationId, supplierProductId: { in: productIds } }
      });
      const catalogProductBySupplierId = new Map(
        catalogProducts.map((product) => [product.supplierProductId, product])
      );
      const observationIds = new Map<string, { id: string; identityFingerprint: string }>();
      for (const batch of chunks(run.products, 400)) {
        const observations = await tx.supplierProductObservation.createManyAndReturn({
          data: batch.map((product) => {
            const catalogProduct = catalogProductBySupplierId.get(product.supplierProductId);
            if (!catalogProduct) throw new SupplierError('catalog_product_persistence_failed');
            return {
              runId: run.id,
              supplierCatalogProductId: catalogProduct.id,
              name: product.name,
              url: product.url,
              sku: product.sku,
              barcode: product.barcode,
              categories: product.categories,
              availability: product.availability,
              purchasePrice: product.purchasePrice,
              currency: product.currency,
              taxTreatment: integration.taxTreatment,
              taxVerifiedAt:
                integration.taxTreatment !== 'unconfirmed'
                  ? integration.taxVerifiedAt
                  : null,
              packQuantity: product.packQuantity,
              edition: product.edition,
              language: product.language,
              expansion: product.expansion,
              identityFingerprint: supplierProductIdentity(product),
              collectedAt: new Date(product.collectedAt)
            };
          }),
          select: { id: true, supplierCatalogProductId: true, identityFingerprint: true }
        });
        for (const observation of observations) {
          observationIds.set(observation.supplierCatalogProductId, {
            id: observation.id,
            identityFingerprint: observation.identityFingerprint
          });
        }
      }
      const invalidatedMappings = run.products.flatMap((product) => {
        const catalogProduct = catalogProductBySupplierId.get(product.supplierProductId);
        const observation = catalogProduct && observationIds.get(catalogProduct.id);
        const previous = previousBySupplierId.get(product.supplierProductId);
        if (
          !catalogProduct || !observation ||
          previous?.mappingStatus !== 'confirmed' ||
          previous.reviewedIdentityFingerprint === observation.identityFingerprint
        ) return [];
        return [{ catalogProduct, observation }];
      });
      if (invalidatedMappings.length) {
        await tx.supplierCatalogProduct.updateMany({
          where: { id: { in: invalidatedMappings.map(({ catalogProduct }) => catalogProduct.id) } },
          data: { mappingStatus: 'needs_review' }
        });
        for (const batch of chunks(invalidatedMappings, 400)) {
          await tx.supplierProductMappingReview.createMany({
            data: batch.map(({ catalogProduct, observation }) => ({
              supplierCatalogProductId: catalogProduct.id,
              observationId: observation.id,
              previousVariantId: catalogProduct.variantId,
              variantId: catalogProduct.variantId,
              action: 'invalidated' as const,
              identityFingerprint: observation.identityFingerprint
            }))
          });
        }
      }
      const external = new Map(
        run.products
          .flatMap((product) => product.external)
          .map((item) => [`${item.variantId}:${item.storeId}`, item])
      );
      const externalRows = Array.from(external.values()).map((item) => ({
            runId: run.id,
            variantId: item.variantId,
            storeId: item.storeId,
            requestedUrl: item.url,
            status: item.availability === 'unknown' ? ('failed' as const) : ('checked' as const),
            availability: item.availability,
            identityVerified: item.availability !== 'unknown',
            checkedAt: new Date(item.checkedAt),
            expiresAt: new Date(Date.parse(item.checkedAt) + 60 * 60 * 1000)
          }));
      for (const batch of chunks(externalRows, 400)) {
        await tx.externalStockObservation.createMany({ data: batch });
      }
    }
    await tx.supplierCatalogRun.update({
      where: { id: run.id },
      data: {
        status: run.status,
        completedAt: new Date(),
        errors: run.errors,
        flags: run.flags,
        productCount: run.products.length,
        catalogComplete: run.status === 'staged' || run.status === 'rejected',
        authenticatedAt: run.status === 'failed' ? null : new Date()
      }
    });
  }, 60000);
}

async function reviewTarget(tx: Prisma.TransactionClient, supplierId: string) {
  const integration = await tx.supplierIntegration.findUnique({
    where: { supplierId },
    include: { supplier: true }
  });
  if (!integration?.isEnabled || !integration.supplier.isActive)
    throw new SupplierError('integration_not_configured');
  const run = await tx.supplierCatalogRun.findFirst({
    where: { integrationId: integration.id },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }]
  });
  if (
    !run ||
    run.status !== 'staged' ||
    run.errors.length ||
    run.configVersion !== integration.configVersion ||
    integration.updatedAt > run.startedAt ||
    Date.now() - run.startedAt.getTime() >= 60 * 60 * 1000
  )
    throw new SupplierError('run_not_approvable');
  return { integration, run };
}

export async function persistSupplierMapping(
  input: { supplierId: string; supplierProductId: string; variantId: string },
  adminId: string
) {
  return supplierTransaction(input.supplierId, async (tx) => {
    const { integration, run } = await reviewTarget(tx, input.supplierId);
    const product = await tx.supplierCatalogProduct.findUnique({
      where: {
        integrationId_supplierProductId: {
          integrationId: integration.id,
          supplierProductId: input.supplierProductId
        }
      }
    });
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true }
    });
    const observation =
      product &&
      (await tx.supplierProductObservation.findUnique({
        where: {
          runId_supplierCatalogProductId: {
            runId: run.id,
            supplierCatalogProductId: product.id
          }
        }
      }));
    if (!product || !variant || !observation)
      throw new SupplierError('mapping_target_not_found');
    await tx.supplierProductMappingReview.create({
      data: {
        supplierCatalogProductId: product.id,
        observationId: observation.id,
        previousVariantId: product.variantId,
        variantId: variant.id,
        action: 'confirmed',
        identityFingerprint: observation.identityFingerprint,
        editionReviewed: true,
        languageReviewed: true,
        expansionReviewed: true,
        packQuantityReviewed: true,
        reviewedByAdminUserId: adminId
      }
    });
    await tx.supplierCatalogProduct.update({
      where: { id: product.id },
      data: {
        variantId: variant.id,
        mappingMethod: 'manual',
        mappingStatus: 'confirmed',
        reviewedIdentityFingerprint: observation.identityFingerprint,
        reviewedByAdminUserId: adminId,
        reviewedAt: new Date()
      }
    });
  });
}

export async function persistSupplierApproval(
  supplierId: string,
  runId: string,
  adminId: string
) {
  return supplierTransaction(supplierId, async (tx) => {
    const { run } = await reviewTarget(tx, supplierId);
    if (run.id !== runId) throw new SupplierError('run_not_approvable');
    if (run.approvedAt) return;
    await tx.supplierCatalogRun.update({
      where: { id: runId },
      data: { approvedAt: new Date(), approvedByAdminUserId: adminId }
    });
  });
}
