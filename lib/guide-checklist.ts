import { parseDocument } from 'htmlparser2';
import { findAll, textContent } from 'domutils';
import { blockAnchor, blockDefinitions, getProductSlugs, guideBlockSchema, type GuideBlockPayload } from './guide-blocks';
import { isGuideBlockId, safeGuideUrl, sanitizeGuideHtml } from './guide-html';

export type GuideChecklistBlock = Omit<GuideBlockPayload, 'guideId' | 'data' | 'sortOrder'> & {
  id: string;
  sortOrder: number;
  data?: unknown;
};

export type GuideChecklistGuide = {
  blocks?: GuideChecklistBlock[] | null;
  intro?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
};

export type GuidePublicationIssue = { path: string; message: string };

export function checkGuidePublication(
  guide: GuideChecklistGuide,
  options: { catalogSlugs?: ReadonlySet<string> } | ReadonlySet<string> = {}
): GuidePublicationIssue[] {
  const issues: GuidePublicationIssue[] = [];
  const blocks = guide.blocks ?? [];
  const anchors = new Set(blocks.filter((block) => isGuideBlockId(block.id)).map((block) => blockAnchor(block.id)));
  const catalogSlugs = 'has' in options ? options : options.catalogSlugs;
  const add = (path: string, message: string) => { issues.push({ path, message }); };
  const nonempty = (value: unknown) => typeof value === 'string' && Boolean(value.trim());

  function checkUrl(value: unknown, path: string, kind: 'link' | 'image' = 'link') {
    if (!safeGuideUrl(value, kind)) add(path, kind === 'image' ? 'Use a safe HTTP(S) image URL or local path' : 'Use a safe HTTP(S) URL, local path, or UUID block anchor');
    if (kind === 'link' && typeof value === 'string' && value.startsWith('#') && !anchors.has(value.slice(1))) add(path, 'Unknown block anchor');
  }

  function checkImage(url: unknown, alt: unknown, path: string, altPath: string, required = false) {
    if (!nonempty(url)) {
      if (required || nonempty(alt)) add(path, 'Image is required');
      return;
    }
    checkUrl(url, path, 'image');
    if (!nonempty(alt)) add(altPath, 'Image description is required');
  }

  function checkCta(label: unknown, href: unknown, labelPath: string, hrefPath: string) {
    if (nonempty(label) && !nonempty(href)) add(hrefPath, 'Button destination is required with a label');
    if (nonempty(href) && !nonempty(label)) add(labelPath, 'Button label is required with a destination');
    if (nonempty(href)) checkUrl(href, hrefPath);
  }

  function checkHtml(value: unknown, path: string, required: boolean) {
    if (typeof value !== 'string') {
      if (required) add(path, 'Content is required');
      return;
    }
    const sanitized = parseDocument(sanitizeGuideHtml(value));
    if (required && !textContent(sanitized).replace(/[\s\u00a0\u200b-\u200d\ufeff]/g, '')) add(path, 'Content must contain visible text');
    const raw = parseDocument(value);
    findAll((element) => element.name === 'a' && 'href' in element.attribs, raw.children).forEach((element, index) => checkUrl(element.attribs.href, `${path}.links.${index}.href`));
    findAll((element) => element.name === 'img', raw.children).forEach((element, index) => checkImage(element.attribs.src, element.attribs.alt, `${path}.images.${index}.src`, `${path}.images.${index}.alt`, true));
  }

  function checkData(value: unknown, path: string, generatedProductCta = false) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => checkData(item, `${path}.${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;
    if ('ctaHref' in data || ('ctaLabel' in data && !generatedProductCta)) checkCta(data.ctaLabel, data.ctaHref, `${path}.ctaLabel`, `${path}.ctaHref`);
    if ('buttonText' in data || 'buttonUrl' in data) checkCta(data.buttonText, data.buttonUrl, `${path}.buttonText`, `${path}.buttonUrl`);
    if ('imageUrl' in data || 'imageAlt' in data) checkImage(data.imageUrl, data.imageAlt, `${path}.imageUrl`, `${path}.imageAlt`);
    for (const [key, item] of Object.entries(data)) checkData(item, `${path}.${key}`);
  }

  checkImage(guide.coverImageUrl, guide.coverImageAlt, 'coverImageUrl', 'coverImageAlt', true);
  const ids = new Set<string>();
  blocks.forEach((block, index) => {
    const path = `blocks.${index}`;
    if (!isGuideBlockId(block.id)) add(`${path}.id`, 'Use a UUID block ID');
    if (ids.has(block.id)) add(`${path}.id`, 'Block IDs must be unique');
    ids.add(block.id);
    const parsed = guideBlockSchema.safeParse(block);
    if (!parsed.success) for (const issue of parsed.error.issues) add(`${path}.${issue.path.join('.')}`, issue.message);
    checkImage(block.imageUrl, block.imageAlt, `${path}.imageUrl`, `${path}.imageAlt`, block.type === 'image');
    checkCta(block.buttonText, block.buttonUrl, `${path}.buttonText`, `${path}.buttonUrl`);
    checkData(block.data, `${path}.data`, block.type === 'product_recommendation');
    const data = block.data && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data as Record<string, unknown> : {};
    const richFields = blockDefinitions[block.type]?.fields.filter((field) => field.kind === 'richtext') ?? [];
    for (const field of richFields) {
      const value = field.path === 'body' ? block.body : data[field.path.slice('data.'.length)];
      if (field.required || value != null) checkHtml(value, `${path}.${field.path}`, Boolean(field.required));
    }
    if (catalogSlugs) for (const slug of getProductSlugs(block.data)) {
      if (!catalogSlugs.has(slug)) add(`${path}.data.${block.type === 'product_recommendation' ? 'productSlug' : 'productSlugs'}`, `Unknown product slug: ${slug}`);
    }
  });
  if (!blocks.length) {
    if (!nonempty(guide.intro) && !nonempty(guide.content)) add('content', 'Add guide content or a block');
    if (guide.intro != null) checkHtml(guide.intro, 'intro', true);
    if (guide.content != null) checkHtml(guide.content, 'content', true);
  }
  return issues.filter((issue, index) => issues.findIndex((other) => other.path === issue.path && other.message === issue.message) === index);
}