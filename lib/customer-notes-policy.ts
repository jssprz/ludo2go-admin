import { z } from 'zod';

export const createCustomerNoteSchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
export const updateCustomerNoteSchema = createCustomerNoteSchema.extend({
  version: z.number().int().positive()
});
export const deleteCustomerNoteSchema = z
  .object({ version: z.number().int().positive() })
  .strict();

export function canManageCustomerNote(
  actorId: string,
  role: string,
  authorId: string
) {
  return actorId === authorId || role === 'SUPER_ADMIN';
}

export function isCustomerNotesSetupRequired(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; meta?: { code?: string } };
  return (
    candidate.code === '42P01' ||
    (candidate.code === 'P2010' && candidate.meta?.code === '42P01')
  );
}
