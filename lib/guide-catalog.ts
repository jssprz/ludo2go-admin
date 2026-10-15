import { z } from 'zod';

const catalogResultsSchema = z.array(z.object({ productSlug: z.string() }));

export async function loadGuideCatalogSlugs(slugs: string[]): Promise<Set<string>> {
  const matches = await Promise.all(Array.from(new Set(slugs)).map(async (slug) => {
    const response = await fetch(`/api/variants/search?q=${encodeURIComponent(slug)}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Catalog could not be loaded');
    const results = catalogResultsSchema.parse(await response.json());
    return results.some((variant) => variant.productSlug === slug) ? slug : null;
  }));
  return new Set(matches.filter((slug): slug is string => slug !== null));
}