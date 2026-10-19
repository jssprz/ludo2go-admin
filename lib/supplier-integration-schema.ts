import { z } from 'zod';
import { integrationSchema } from './scraping/supplier-session';

export const adapterOrigins = {
  asmodee: 'https://b2b.asmodee.cl',
  devir: 'https://btb.devir.cl',
  lanae: 'https://lanae.cl'
} as const;
const reference = z.string().regex(/^SUPPLIER_[A-Z0-9_]+$/).max(200).nullable();
const timestamp = z.string().datetime().nullable();
export const supplierIntegrationInput = z.object({
  updatedAt: timestamp,
  adapterKey: z.enum(['asmodee', 'devir', 'lanae']),
  baseUrl: z.string().max(500),
  authMethod: z.enum(['form', 'asmodee_api', 'browser_session']),
  usernameSecretRef: reference,
  passwordSecretRef: reference,
  sessionSecretRef: reference,
  browserSecretRef: reference,
  browserRendering: z.boolean(),
  taxTreatment: z.enum(['unconfirmed', 'vat_included', 'excluding_vat']),
  taxVerifiedAt: timestamp,
  integrationVerifiedAt: timestamp,
  isEnabled: z.boolean(),
  config: z.object({
    verification: integrationSchema.shape.verification.optional(),
    catalog: integrationSchema.shape.catalog.optional()
  }).strict()
}).strict().superRefine((input, context) => {
  const invalid = (path: string) => context.addIssue({ code: 'custom', path: [path], message: 'invalid' });
  if (input.baseUrl) {
    try {
      const url = new URL(input.baseUrl);
      if (url.origin !== adapterOrigins[input.adapterKey] || url.username || url.password || url.search || url.hash) invalid('baseUrl');
    } catch { invalid('baseUrl'); }
  }
  if ((input.authMethod === 'form' && input.adapterKey !== 'devir') ||
      (input.authMethod === 'asmodee_api' && input.adapterKey !== 'asmodee')) invalid('authMethod');
  const paths = [input.config.verification?.path, input.config.verification?.account.path, ...(input.config.catalog?.paths ?? [])];
  for (const path of paths) {
    if (path === undefined) continue;
    try {
      const url = new URL(path, adapterOrigins[input.adapterKey]);
      const allowed = url.origin === adapterOrigins[input.adapterKey] || (input.adapterKey === 'asmodee' && url.origin === 'https://b2b-back.asmodee.cl');
      if (!allowed || url.username || url.password) invalid('config');
      url.searchParams.forEach((_value, key) => {
        if (/password|token|secret|credential|authorization|cookie/i.test(key)) invalid('config');
      });
    } catch { invalid('config'); }
  }
  if (input.taxTreatment === 'unconfirmed' && input.taxVerifiedAt) invalid('taxVerifiedAt');
  if (!input.isEnabled) return;
  if (!input.baseUrl) invalid('baseUrl');
  if (!input.config.verification) invalid('config');
  if (!input.config.catalog) invalid('config');
  if (input.adapterKey === 'asmodee' && !input.config.catalog?.structured) invalid('config');
  if (input.authMethod === 'browser_session') {
    if (!input.sessionSecretRef) invalid('sessionSecretRef');
  } else {
    if (!input.usernameSecretRef) invalid('usernameSecretRef');
    if (!input.passwordSecretRef) invalid('passwordSecretRef');
  }
  if (input.browserRendering && !input.browserSecretRef) invalid('browserSecretRef');
  if (input.taxTreatment !== 'unconfirmed' && !input.taxVerifiedAt) invalid('taxVerifiedAt');
});
export type SupplierIntegrationInput = z.infer<typeof supplierIntegrationInput>;