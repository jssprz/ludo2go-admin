import type { SupplierIntegrationInput } from './supplier-integration-schema';

const origins: Record<SupplierIntegrationInput['adapterKey'], string> = {
  asmodee: 'https://b2b.asmodee.cl',
  devir: 'https://btb.devir.cl',
  lanae: 'https://lanae.cl'
};

const lanaeCatalogPath = '/collections/all';

export function createSupplierIntegrationDefaults(
  adapterKey: SupplierIntegrationInput['adapterKey'],
  verifiedAt = new Date().toISOString()
): SupplierIntegrationInput {
  const asmodee = adapterKey === 'asmodee';
  const devir = adapterKey === 'devir';
  const catalogPath = asmodee
    ? 'https://b2b-back.asmodee.cl/api/catalog-products?include=family%2CmainImage%2Cpublisher%2Cfamily.restrictedCustomers&per_page=50&page=1&sort=name'
    : '/categoria-producto/devir/';
  return {
    updatedAt: null,
    adapterKey,
    baseUrl: origins[adapterKey],
    authMethod: asmodee ? 'asmodee_api' : devir ? 'form' : 'browser_session',
    usernameSecretRef: asmodee
      ? 'SUPPLIER_ASMODEE_USERNAME'
      : devir
        ? 'SUPPLIER_DEVIR_USERNAME'
        : null,
    passwordSecretRef: asmodee
      ? 'SUPPLIER_ASMODEE_PASSWORD'
      : devir
        ? 'SUPPLIER_DEVIR_PASSWORD'
        : null,
    sessionSecretRef: null,
    browserSecretRef: null,
    browserRendering: false,
    taxTreatment: devir ? 'vat_included' : 'unconfirmed',
    taxVerifiedAt: devir ? verifiedAt : null,
    integrationVerifiedAt: null,
    isEnabled: false,
    config: {
      verification: asmodee
        ? {
            path: catalogPath,
            accountSelector: 'data',
            account: {
              path: 'https://b2b-back.asmodee.cl/api/auth',
              expectedIdentity: '$authenticated',
              identityPath: 'id'
            },
            priceSelector: 'data.0.customerPrice.total',
            priceEvidence: 'account_purchase_price',
            verifiedAt,
            structuredPricePath: 'data.0.customerPrice.total'
          }
        : adapterKey === 'lanae'
          ? {
              path: lanaeCatalogPath,
              priceSelector: '.price-item',
              priceEvidence: 'public_price',
              verifiedAt
            }
          : devir
          ? {
              path: '/producto/jdm-polilla-tramposa/',
              accountSelector: 'body.logged-in',
              account: {
                path: '/producto/jdm-polilla-tramposa/',
                expectedIdentity: 'Log out',
                identitySelector: 'a[href*="customer-logout"]'
              },
              priceSelector:
                '.summary .price ins .woocommerce-Price-amount bdi',
              priceEvidence: 'account_purchase_price',
              verifiedAt
            }
          : undefined,
      catalog:
        adapterKey === 'lanae'
          ? {
              paths: [lanaeCatalogPath],
              productSelector: 'li.grid__item',
              nextSelector:
                'a[rel="next"], a.pagination__item-arrow[aria-label*="ext"]',
              terminalSelector: 'main',
              priceSelector: '.price-item--regular, .price-item',
              inStockSelector: '.price:not(.price--sold-out)',
              outOfStockSelector: '.price--sold-out',
              expectedMinimum: 1,
              maxPages: 60
            }
          : asmodee || devir
          ? {
              paths: [catalogPath],
              productSelector: devir ? 'li.product' : 'body',
              nextSelector: devir ? 'a.next.page-numbers' : 'body',
              terminalSelector: devir
                ? '.woocommerce-pagination .page-numbers > li:last-child > .page-numbers.current'
                : 'body',
              priceSelector: asmodee
                ? 'customerPrice.total'
                : '.price ins .woocommerce-Price-amount bdi',
              inStockSelector: devir ? '.instock' : 'AVAILABLE',
              outOfStockSelector: devir ? '.outofstock' : 'OUT_OF_STOCK',
              expectedMinimum: asmodee ? 2500 : 426,
              maxPages: 60,
              ...(asmodee
                ? {
                    structured: {
                      itemsPath: 'data',
                      nextPath: 'links.next',
                      totalPath: 'meta.total',
                      id: 'id',
                      name: 'name',
                      sku: 'sku',
                      barcode: 'ean',
                      url: '',
                      categories: 'family.name',
                      availability: 'status',
                      inStockValue: 'AVAILABLE',
                      outOfStockValue: 'OUT_OF_STOCK',
                      purchasePrice: 'customerPrice.total',
                      packQuantity: 'units_per_box',
                      edition: '',
                      language: '',
                      expansion: '',
                      paginationVerifiedAt: verifiedAt
                    }
                  }
                : {})
            }
          : undefined
    }
  };
}
