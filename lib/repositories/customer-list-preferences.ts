import 'server-only';

import { prisma } from '@jssprz/ludo2go-database';
import {
  customerListPreferencesSchema,
  EMPTY_CUSTOMER_LIST_PREFERENCES,
  type CustomerListPreferences
} from '@/lib/customer-list-preferences';

export class CustomerListPreferencesError extends Error {
  constructor(
    public code: string,
    public status: number
  ) {
    super(code);
  }
}

export interface CustomerListPreferencesResult {
  preferences: CustomerListPreferences;
  version: number;
}

export async function getCustomerListPreferences(
  adminUserId: string
): Promise<CustomerListPreferencesResult> {
  const row = await prisma.adminCustomerListPreference.findUnique({
    where: { adminUserId },
    select: { preferences: true, version: true }
  });
  return {
    preferences: customerListPreferencesSchema.parse(
      row?.preferences ?? EMPTY_CUSTOMER_LIST_PREFERENCES
    ),
    version: row?.version ?? 0
  };
}

export async function saveCustomerListPreferences(
  adminUserId: string,
  preferences: CustomerListPreferences,
  expectedVersion: number
): Promise<CustomerListPreferencesResult> {
  const validated = customerListPreferencesSchema.parse(preferences);
  if (expectedVersion === 0) {
    try {
      const row = await prisma.adminCustomerListPreference.create({
        data: { adminUserId, preferences: validated, version: 1 },
        select: { preferences: true, version: true }
      });
      return {
        preferences: customerListPreferencesSchema.parse(row.preferences),
        version: row.version
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new CustomerListPreferencesError('conflict', 409);
      }
      throw error;
    }
  }

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.adminCustomerListPreference.updateMany({
      where: { adminUserId, version: expectedVersion },
      data: {
        preferences: validated,
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });
    if (updated.count !== 1) {
      throw new CustomerListPreferencesError('conflict', 409);
    }
    const row = await transaction.adminCustomerListPreference.findUniqueOrThrow(
      {
        where: { adminUserId },
        select: { preferences: true, version: true }
      }
    );
    return {
      preferences: customerListPreferencesSchema.parse(row.preferences),
      version: row.version
    };
  });
}
