import { expect, test } from 'vitest';
import { supplierIntegrationInput } from '../lib/supplier-integration-schema';

const draft = {
  updatedAt: null, adapterKey: 'devir', baseUrl: '', authMethod: 'form',
  usernameSecretRef: null, passwordSecretRef: null, sessionSecretRef: null,
  browserSecretRef: null, browserRendering: false, taxTreatment: 'unconfirmed',
  taxVerifiedAt: null, integrationVerifiedAt: null, isEnabled: false, config: {}
};
test('disabled drafts can be incomplete but enabled integrations cannot', () => {
  expect(supplierIntegrationInput.safeParse(draft).success).toBe(true);
  expect(supplierIntegrationInput.safeParse({ ...draft, isEnabled: true }).success).toBe(false);
});
test('rejects raw secrets, unknown config keys and incorrect origins/auth combinations', () => {
  for (const change of [
    { passwordSecretRef: 'actual-password' }, { password: 'actual-password' },
    { config: { token: 'private' } }, { baseUrl: 'https://evil.example' },
    { authMethod: 'asmodee_api' }
  ]) expect(supplierIntegrationInput.safeParse({ ...draft, ...change }).success).toBe(false);
});

const verification = {
  path: '/catalog', accountSelector: '.account',
  account: { path: '/account', expectedIdentity: 'fixture-account-id', identitySelector: '.identity' },
  priceSelector: '.purchase-price', priceEvidence: 'account_purchase_price',
  verifiedAt: '2026-10-18T00:00:00Z'
};
const catalog = {
  paths: ['/catalog'], terminalSelector: '.last-page', priceSelector: '.purchase-price',
  inStockSelector: '.in-stock', outOfStockSelector: '.out-of-stock', expectedMinimum: 10
};
const enabled = {
  ...draft, isEnabled: true, baseUrl: 'https://btb.devir.cl',
  usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME', passwordSecretRef: 'SUPPLIER_DEVIR_PASSWORD',
  config: { verification, catalog }
};
test('complete enabled integrations use appropriate references and do not fabricate verification dates', () => {
  const parsed = supplierIntegrationInput.parse(enabled);
  expect(parsed.integrationVerifiedAt).toBe(null);
  expect(parsed.taxVerifiedAt).toBe(null);
  expect(parsed.config.verification?.verifiedAt).toBe(verification.verifiedAt);
  expect(supplierIntegrationInput.safeParse({ ...enabled, authMethod: 'browser_session' }).success).toBe(false);
  expect(supplierIntegrationInput.safeParse({ ...enabled, authMethod: 'browser_session', sessionSecretRef: 'SUPPLIER_DEVIR_SESSION' }).success).toBe(true);
  expect(supplierIntegrationInput.safeParse({ ...enabled, browserRendering: true }).success).toBe(false);
  expect(supplierIntegrationInput.safeParse({ ...enabled, taxTreatment: 'vat_included' }).success).toBe(false);
});
test('Asmodee requires the complete structured catalog even with complete login and verification', () => {
  const asmodee = { ...enabled, adapterKey: 'asmodee', authMethod: 'asmodee_api', baseUrl: 'https://b2b.asmodee.cl' };
  expect(supplierIntegrationInput.safeParse(asmodee).success).toBe(false);
  const structured = {
    itemsPath: 'items', nextPath: 'next', totalPath: 'total', id: 'id', name: 'name',
    sku: 'sku', barcode: 'barcode', url: 'url', categories: 'categories', availability: 'stock',
    inStockValue: true, outOfStockValue: false, purchasePrice: 'purchasePrice', packQuantity: 'pack',
    edition: 'edition', language: 'language', expansion: 'expansion', paginationVerifiedAt: verification.verifiedAt
  };
  expect(supplierIntegrationInput.safeParse({ ...asmodee, config: { verification, catalog: { ...catalog, structured } } }).success).toBe(true);
});
test('nested raw credential keys and out-of-origin or token-bearing requests are rejected even in disabled drafts', () => {
  for (const config of [
    { verification: { ...verification, password: 'private' } },
    { verification: { ...verification, account: { ...verification.account, token: 'private' } } },
    { catalog: { ...catalog, cookie: 'private' } },
    { catalog: { ...catalog, paths: ['https://evil.example/catalog'] } },
    { verification: { ...verification, path: '/catalog?access_token=private' } }
  ]) expect(supplierIntegrationInput.safeParse({ ...draft, config }).success).toBe(false);
});