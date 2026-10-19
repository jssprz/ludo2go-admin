import 'server-only';
import type { SupplierIntegration, Prisma } from '@prisma/client';
import { supplierTransaction } from './opportunities-store';
import { readIntegration } from './scraping/supplier-session';
import { supplierIntegrationInput } from './supplier-integration-schema';

export class IntegrationEditorError extends Error {
  constructor(public readonly code: 'supplier_not_found' | 'integration_conflict' | 'scan_already_running') {
    super(code);
  }
}

function editable(row: SupplierIntegration) {
  return supplierIntegrationInput.innerType().parse({
    updatedAt: row.updatedAt.toISOString(),
    adapterKey: row.adapterKey,
    baseUrl: row.baseUrl,
    authMethod: row.authMethod,
    usernameSecretRef: row.usernameSecretRef,
    passwordSecretRef: row.passwordSecretRef,
    sessionSecretRef: row.sessionSecretRef,
    browserSecretRef: row.browserSecretRef,
    browserRendering: row.browserRendering,
    taxTreatment: row.taxTreatment,
    taxVerifiedAt: row.taxVerifiedAt?.toISOString() ?? null,
    integrationVerifiedAt: row.integrationVerifiedAt?.toISOString() ?? null,
    isEnabled: row.isEnabled,
    config: row.config
  });
}

export async function getSupplierIntegration(supplierId: string) {
  return supplierTransaction(supplierId, async (tx) => {
    if (!await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }))
      throw new IntegrationEditorError('supplier_not_found');
    const row = await tx.supplierIntegration.findUnique({ where: { supplierId } });
    return { integration: row ? editable(row) : null, configVersion: row?.configVersion ?? null };
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}

export async function saveSupplierIntegration(supplierId: string, payload: unknown) {
  const input = supplierIntegrationInput.parse(payload);
  return supplierTransaction(supplierId, async (tx) => {
    if (!await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }))
      throw new IntegrationEditorError('supplier_not_found');
    const current = await tx.supplierIntegration.findUnique({ where: { supplierId } });
    if ((current?.updatedAt.toISOString() ?? null) !== input.updatedAt)
      throw new IntegrationEditorError('integration_conflict');
    if (current) {
      const running = await tx.supplierCatalogRun.findFirst({
        where: { integrationId: current.id, status: 'running', startedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } }
      });
      if (running) throw new IntegrationEditorError('scan_already_running');
    }
    const { updatedAt, ...fields } = input;
    const data = {
      ...fields,
      config: fields.config as Prisma.InputJsonValue,
      taxVerifiedAt: fields.taxVerifiedAt ? new Date(fields.taxVerifiedAt) : null,
      integrationVerifiedAt: fields.integrationVerifiedAt ? new Date(fields.integrationVerifiedAt) : null
    };
    const behavior = (value: typeof input) => {
      const { updatedAt, integrationVerifiedAt, ...rest } = value;
      return canonical(rest);
    };
    const configVersion = current
      ? current.configVersion + (behavior(editable(current)) === behavior(input) ? 0 : 1)
      : 1;
    if (input.isEnabled) readIntegration({
      ...data, id: current?.id ?? '', supplierId, configVersion,
      createdAt: current?.createdAt ?? new Date(), updatedAt: new Date(),
      config: data.config as Prisma.JsonValue
    });
    if (current && canonical(editable(current)) === canonical(input))
      return { integration: editable(current), configVersion };
    const row = current
      ? await tx.supplierIntegration.update({ where: { supplierId }, data: { ...data, configVersion, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } })
      : await tx.supplierIntegration.create({ data: { ...data, supplierId, configVersion } });
    return { integration: editable(row), configVersion: row.configVersion };
  });
}