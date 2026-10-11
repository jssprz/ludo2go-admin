import { z } from 'zod';

export const CUSTOMER_LIST_COLUMNS = [
  'segment',
  'ltv',
  'orders',
  'lastPurchase',
  'lastActivity',
  'status',
  'phone',
  'joined',
  'activity',
  'cartValue',
  'risk'
] as const;

export type CustomerListColumn = (typeof CUSTOMER_LIST_COLUMNS)[number];

export const DEFAULT_COLUMNS: CustomerListColumn[] = [
  'segment',
  'ltv',
  'orders',
  'lastPurchase',
  'lastActivity',
  'status'
];

const columnsSchema = z
  .array(z.enum(CUSTOMER_LIST_COLUMNS))
  .max(CUSTOMER_LIST_COLUMNS.length)
  .refine((columns) => new Set(columns).size === columns.length);

const savedQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    sort: z
      .enum([
        'name',
        'email',
        'ltv',
        'orders',
        'lastPurchase',
        'lastActivity',
        'cartValue',
        'risk'
      ])
      .optional(),
    order: z.enum(['asc', 'desc']).optional(),
    size: z.enum(['20', '50', '100']).optional(),
    segment: z.enum(['new', 'repeat', 'vip', 'inactive', 'atRisk']).optional(),
    activity: z.enum(['7', '30', '90', 'inactive']).optional(),
    purchase: z.enum(['none', 'one', 'repeat']).optional(),
    cart: z.enum(['active', 'abandoned']).optional(),
    risk: z.enum(['high', 'insufficient']).optional(),
    quality: z.enum(['flagged', 'duplicate', 'internal']).optional(),
    view: z
      .enum([
        'attention',
        'activeCarts',
        'abandoned',
        'repeat',
        'vip',
        'inactive',
        'quality'
      ])
      .optional(),
    columns: z
      .string()
      .max(200)
      .refine(
        (value) =>
          columnsSchema.safeParse(
            value === '' || value === 'none' ? [] : value.split(',')
          ).success
      )
      .optional()
  })
  .strict();

const viewIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const customerListPreferencesSchema = z
  .object({
    columns: columnsSchema,
    views: z
      .array(
        z
          .object({
            id: viewIdSchema,
            name: z.string().trim().min(1).max(80),
            query: savedQuerySchema
          })
          .strict()
      )
      .max(100),
    defaultView: viewIdSchema.nullable()
  })
  .strict()
  .superRefine((preferences, context) => {
    const ids = new Set(preferences.views.map((view) => view.id));
    if (ids.size !== preferences.views.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['views'],
        message: 'View IDs must be unique'
      });
    }
    if (preferences.defaultView !== null && !ids.has(preferences.defaultView)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultView'],
        message: 'Default view must reference a saved view'
      });
    }
  });

export interface CustomerListPreferences {
  columns: string[];
  views: Array<{ id: string; name: string; query: Record<string, string> }>;
  defaultView: string | null;
}

export const EMPTY_CUSTOMER_LIST_PREFERENCES: CustomerListPreferences = {
  columns: [...DEFAULT_COLUMNS],
  views: [],
  defaultView: null
};

export const customerListPreferencesPayloadSchema = z
  .object({
    preferences: customerListPreferencesSchema,
    version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
  })
  .strict();
