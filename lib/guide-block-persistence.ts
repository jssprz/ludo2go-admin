import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getProductSlugs, guideBlockSchema, guideBlockSortSchema, type GuideBlockPayload } from './guide-blocks';

export class GuideBlockError extends Error {
  constructor(message: string, public status = 400, public issues: z.ZodIssue[] = []) {
    super(message);
  }
}

function invalid(message: string, path: (string | number)[]): never {
  throw new GuideBlockError(message, 400, [{ code: 'custom', path, message }]);
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return invalid('Invalid JSON body', []); }
}

export async function parseGuideBlockRequest(request: Request, requireGuideId = false): Promise<GuideBlockPayload> {
  const result = guideBlockSchema.safeParse(await readJson(request));
  if (!result.success) throw new GuideBlockError('Invalid guide block', 400, result.error.issues);
  if (requireGuideId && !result.data.guideId) invalid('Guide ID is required', ['guideId']);
  return result.data;
}

export async function parseGuideBlockSortRequest(request: Request) {
  const result = guideBlockSortSchema.safeParse(await readJson(request));
  if (!result.success) throw new GuideBlockError('Invalid sort order', 400, result.error.issues);
  return result.data.updates;
}

export function guideBlockErrorResponse(error: unknown): { status: number; body: { error: string; issues?: z.ZodIssue[] } } | null {
  if (error instanceof GuideBlockError) return { status: error.status, body: { error: error.message, issues: error.issues } };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return { status: 409, body: { error: 'Guide changed concurrently. Please retry.' } };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return { status: 404, body: { error: 'Guide block not found' } };
  return null;
}

const guideInclude = { guide: { select: { id: true, title: true, slug: true } } } as const;

async function addReferencedVariants(transaction: Prisma.TransactionClient, guideId: string, data: unknown) {
  const slugs = getProductSlugs(data);
  if (!slugs.length) return;
  const products = await transaction.product.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, variants: { select: { id: true }, orderBy: { id: 'asc' } } }
  });
  const found = new Set(products.map((product) => product.slug));
  const missing = slugs.filter((slug) => !found.has(slug));
  if (missing.length) invalid(`Unknown product slugs: ${missing.join(', ')}`, ['data', slugs.length === 1 && !Array.isArray((data as Record<string, unknown>)?.productSlugs) ? 'productSlug' : 'productSlugs']);
  const links = await transaction.guideProductVariant.findMany({ where: { guideId }, select: { variantId: true, sortOrder: true } });
  const linked = new Set(links.map((link) => link.variantId));
  let sortOrder = links.reduce((maximum, link) => Math.max(maximum, link.sortOrder), -1) + 1;
  const newLinks = slugs.flatMap((slug) => products.find((product) => product.slug === slug)!.variants)
    .filter((variant) => !linked.has(variant.id))
    .map((variant) => ({ guideId, variantId: variant.id, sortOrder: sortOrder++ }));
  if (newLinks.length) await transaction.guideProductVariant.createMany({ data: newLinks, skipDuplicates: true });
}

export async function saveGuideBlock(transaction: Prisma.TransactionClient, payload: GuideBlockPayload, id?: string) {
  const existing = id ? await transaction.guideBlock.findUnique({ where: { id }, select: { guideId: true } }) : null;
  if (id && !existing) throw new GuideBlockError('Guide block not found', 404);
  const guideId = existing?.guideId ?? payload.guideId;
  if (!guideId) invalid('Guide ID is required', ['guideId']);
  if (existing && payload.guideId && payload.guideId !== existing.guideId) invalid('A block cannot be moved to another guide', ['guideId']);
  const guide = await transaction.guide.findUnique({ where: { id: guideId }, select: { id: true } });
  if (!guide) throw new GuideBlockError('Guide not found', 404);
  await addReferencedVariants(transaction, guideId, payload.data);
  const { guideId: ignoredGuideId, sortOrder: ignoredSortOrder, data, ...fields } = payload;
  const blockData = { ...fields, ...(data === undefined ? {} : { data: data === null ? Prisma.DbNull : data as Prisma.InputJsonObject }) };
  if (id) return transaction.guideBlock.update({ where: { id }, data: blockData, include: guideInclude });
  const maximum = await transaction.guideBlock.aggregate({ where: { guideId }, _max: { sortOrder: true } });
  return transaction.guideBlock.create({ data: { ...blockData, guideId, sortOrder: (maximum._max.sortOrder ?? -1) + 1 }, include: guideInclude });
}

export async function sortGuideBlocks(transaction: Prisma.TransactionClient, updates: { id: string; sortOrder: number }[]) {
  const parsed = guideBlockSortSchema.safeParse({ updates });
  if (!parsed.success) throw new GuideBlockError('Invalid sort order', 400, parsed.error.issues);
  const requested = await transaction.guideBlock.findMany({ where: { id: { in: updates.map((update) => update.id) } }, select: { id: true, guideId: true } });
  if (requested.length !== updates.length) invalid('One or more blocks do not exist', ['updates']);
  const guideIds = new Set(requested.map((block) => block.guideId));
  if (guideIds.size !== 1) invalid('All blocks must belong to one guide', ['updates']);
  const all = await transaction.guideBlock.findMany({ where: { guideId: requested[0].guideId }, select: { id: true } });
  const ids = new Set(updates.map((update) => update.id));
  if (all.length !== updates.length || all.some((block) => !ids.has(block.id))) invalid('Reorder must include every block in the guide', ['updates']);
  for (const update of updates) await transaction.guideBlock.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } });
}

export async function deleteGuideBlock(transaction: Prisma.TransactionClient, id: string) {
  const block = await transaction.guideBlock.findUnique({ where: { id }, select: { guideId: true } });
  if (!block) throw new GuideBlockError('Guide block not found', 404);
  await transaction.guideBlock.delete({ where: { id } });
  const remaining = await transaction.guideBlock.findMany({ where: { guideId: block.guideId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, sortOrder: true } });
  for (let sortOrder = 0; sortOrder < remaining.length; sortOrder++) {
    const item = remaining[sortOrder];
    if (item.sortOrder !== sortOrder) await transaction.guideBlock.update({ where: { id: item.id }, data: { sortOrder } });
  }
}