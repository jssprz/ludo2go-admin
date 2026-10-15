import { z } from 'zod';

export const guideBlockTypes = ['rich_text', 'heading', 'hero', 'intro', 'image', 'criteria', 'quote', 'faq', 'product_list', 'product_recommendation', 'comparison', 'product_grid', 'cta', 'final_cta'] as const;
export type GuideBlockType = (typeof guideBlockTypes)[number];

export type BlockField = {
  path: string;
  label: string;
  kind: 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'strings' | 'products' | 'items';
  required?: boolean;
  fields?: BlockField[];
};
export type BlockDefinition = {
  label: string;
  fields: BlockField[];
  defaultData: Record<string, unknown>;
};

const field = (path: string, label: string, kind: BlockField['kind'] = 'text', required = false): BlockField => ({ path, label, kind, required });
const title = field('data.title', 'Title');
const productFields = [title, field('data.description', 'Description', 'textarea'), field('data.productSlugs', 'Products', 'products', true)];
const ctaFields = [title, field('data.description', 'Description', 'textarea'), field('data.ctaLabel', 'Button label', 'text', true), field('data.ctaHref', 'Button destination', 'url', true)];

export const blockDefinitions: Record<GuideBlockType, BlockDefinition> = {
  rich_text: { label: 'Rich text', fields: [field('body', 'Content', 'richtext', true)], defaultData: {} },
  heading: { label: 'Heading', fields: [field('title', 'Heading', 'text', true)], defaultData: {} },
  hero: { label: 'Hero', fields: [field('data.title', 'Title', 'text', true), field('data.subtitle', 'Subtitle', 'textarea'), field('data.imageUrl', 'Image', 'image'), field('data.imageAlt', 'Image description'), field('data.ctaLabel', 'Button label'), field('data.ctaHref', 'Button destination', 'url')], defaultData: {} },
  intro: { label: 'Introduction', fields: [field('data.content', 'Content', 'richtext', true)], defaultData: {} },
  image: { label: 'Image', fields: [field('imageUrl', 'Image', 'image', true), field('imageAlt', 'Image description'), field('title', 'Caption')], defaultData: {} },
  criteria: { label: 'Criteria', fields: [title, { ...field('data.items', 'Criteria', 'items', true), fields: [field('title', 'Title', 'text', true), field('description', 'Description', 'textarea', true)] }], defaultData: { items: [] } },
  quote: { label: 'Quote', fields: [field('body', 'Quote', 'richtext', true), field('title', 'Attribution')], defaultData: {} },
  faq: { label: 'FAQ', fields: [title, { ...field('data.questions', 'Questions', 'items', true), fields: [field('question', 'Question', 'text', true), field('answer', 'Answer', 'textarea', true)] }], defaultData: { questions: [] } },
  product_list: { label: 'Product list', fields: productFields, defaultData: { productSlugs: [] } },
  product_recommendation: { label: 'Product recommendation', fields: [title, field('data.productSlug', 'Product', 'products', true), field('data.summary', 'Summary', 'textarea'), field('data.bestFor', 'Best for', 'strings'), field('data.ctaLabel', 'Button label')], defaultData: { bestFor: [] } },
  comparison: { label: 'Comparison', fields: [title, { ...field('data.items', 'Comparisons', 'items', true), fields: [field('label', 'Label', 'text', true), field('products', 'Product names', 'strings', true)] }], defaultData: { items: [] } },
  product_grid: { label: 'Product grid', fields: productFields, defaultData: { productSlugs: [] } },
  cta: { label: 'Call to action', fields: [field('title', 'Title'), field('body', 'Content', 'richtext'), field('buttonText', 'Button label', 'text', true), field('buttonUrl', 'Button destination', 'url', true)], defaultData: {} },
  final_cta: { label: 'Final call to action', fields: ctaFields, defaultData: {} }
};

const text = z.string().trim().min(1, 'Required');
const optionalText = z.string().optional();
const destination = text.refine((value) => {
  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Use an HTTP(S) URL, local path, or anchor');
const imageUrl = text.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP(S) image URL');
const strings = z.array(text).min(1, 'Add at least one item');
const productData = z.object({ title: optionalText, description: optionalText, productSlugs: strings }).passthrough();
const emptyData = z.object({}).passthrough();

export const blockDataSchemas = {
  rich_text: emptyData,
  heading: emptyData,
  hero: z.object({ title: text, subtitle: optionalText, imageUrl: imageUrl.optional(), imageAlt: optionalText, ctaLabel: text.optional(), ctaHref: destination.optional() }).passthrough().superRefine((data, context) => {
    if (Boolean(data.ctaLabel) !== Boolean(data.ctaHref)) context.addIssue({ code: 'custom', path: [data.ctaLabel ? 'ctaHref' : 'ctaLabel'], message: 'Button label and destination must be provided together' });
  }),
  intro: z.object({ content: text }).passthrough(),
  image: emptyData,
  criteria: z.object({ title: optionalText, items: z.array(z.object({ title: text, description: text }).passthrough()).min(1) }).passthrough(),
  quote: emptyData,
  faq: z.object({ title: optionalText, questions: z.array(z.object({ question: text, answer: text }).passthrough()).min(1) }).passthrough(),
  product_list: productData,
  product_recommendation: z.object({ title: optionalText, productSlug: text, summary: optionalText, bestFor: z.array(text).optional(), ctaLabel: optionalText }).passthrough(),
  comparison: z.object({ title: optionalText, items: z.array(z.object({ label: text, products: strings }).passthrough()).min(1) }).passthrough(),
  product_grid: productData,
  cta: emptyData,
  final_cta: z.object({ title: optionalText, description: optionalText, ctaLabel: text, ctaHref: destination }).passthrough()
} satisfies Record<GuideBlockType, z.ZodTypeAny>;

const nullableText = z.string().nullable().optional();
export const guideBlockSchema = z.object({
  guideId: z.string().uuid().optional(),
  type: z.enum(guideBlockTypes),
  sortOrder: z.number().int().nonnegative().optional(),
  title: nullableText,
  body: nullableText,
  imageUrl: nullableText,
  imageAlt: nullableText,
  buttonText: nullableText,
  buttonUrl: nullableText,
  data: z.record(z.unknown()).nullable().optional()
}).superRefine((block, context) => {
  const result = blockDataSchemas[block.type].safeParse(block.data ?? {});
  if (!result.success) for (const issue of result.error.issues) context.addIssue({ ...issue, path: ['data', ...issue.path] });
  const required = block.type === 'heading' ? ['title'] : ['rich_text', 'quote'].includes(block.type) ? ['body'] : block.type === 'image' ? ['imageUrl'] : block.type === 'cta' ? ['buttonText', 'buttonUrl'] : [];
  for (const key of required) {
    const value = block[key as 'title' | 'body' | 'imageUrl' | 'buttonText' | 'buttonUrl'];
    if (!value?.trim()) context.addIssue({ code: 'custom', path: [key], message: 'Required' });
  }
  for (const [key, schema] of [['imageUrl', imageUrl], ['buttonUrl', destination]] as const) {
    if (block[key]) {
      const parsed = schema.safeParse(block[key]);
      if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: [key] });
    }
  }
}).transform((block) => block.data ? { ...block, data: blockDataSchemas[block.type].parse(block.data) } : block);
export type GuideBlockPayload = z.infer<typeof guideBlockSchema>;

export function getProductSlugs(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const record = data as Record<string, unknown>;
  const candidates = [record.productSlug, ...(Array.isArray(record.productSlugs) ? record.productSlugs : [])];
  return Array.from(new Set(candidates.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim())));
}

export function blockAnchor(id: string): string { return `block-${id}`; }

export function blockSummary(block: { type: GuideBlockType; title?: string | null; body?: string | null; data?: unknown }): string {
  const data = block.data && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data as Record<string, unknown> : {};
  const summary = block.title || data.title || data.summary || data.content || block.body;
  if (typeof summary === 'string') return summary.replace(/<[^>]*>/g, '').slice(0, 160);
  const slugs = getProductSlugs(data);
  if (slugs.length) return slugs.join(', ');
  for (const key of ['questions', 'items']) if (Array.isArray(data[key])) return `${data[key].length} ${key}`;
  return blockDefinitions[block.type].label;
}

export function getGuideDisplayBlocks<Block extends { type: string; sortOrder: number }>(guide: { blocks: Block[]; intro?: string | null; content?: string | null }) {
  const blocks = [...guide.blocks].sort((left, right) => left.sortOrder - right.sortOrder);
  return { blocks, intro: blocks.length ? null : guide.intro ?? null, content: blocks.length ? null : guide.content ?? null };
}

export const guideBlockSortSchema = z.object({ updates: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().nonnegative() })).min(1) }).superRefine(({ updates }, context) => {
  if (new Set(updates.map((update) => update.id)).size !== updates.length) context.addIssue({ code: 'custom', path: ['updates'], message: 'Block IDs must be unique' });
  if ([...updates].sort((left, right) => left.sortOrder - right.sortOrder).some((update, index) => update.sortOrder !== index)) context.addIssue({ code: 'custom', path: ['updates'], message: 'Sort orders must be a complete zero-based sequence' });
});