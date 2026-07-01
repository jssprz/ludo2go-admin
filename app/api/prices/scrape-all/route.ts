import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';

import { auth } from '@/lib/auth';
import { scrapeAndInsertExternalPrice } from '@/lib/scraping/external-price';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ScrapeTarget = {
	variantId: string;
	storeId: string;
	url: string;
};

function toAbsoluteUrl(storeUrl: string, pathOrUrl: string) {
	try {
		return new URL(pathOrUrl).toString();
	} catch {
		const base = storeUrl.endsWith('/') ? storeUrl : `${storeUrl}/`;
		const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
		return new URL(normalizedPath, base).toString();
	}
}

async function runWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>
) {
	const results: R[] = [];
	let index = 0;

	async function runWorker() {
		while (index < items.length) {
			const current = items[index];
			index += 1;
			results.push(await worker(current));
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
	await Promise.all(workers);
	return results;
}

export async function POST() {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		const links = await prisma.itemPriceInStore.findMany({
			where: {
				urlPathInStore: {
					not: '',
				},
			},
			include: {
				store: {
					select: {
						url: true,
					},
				},
			},
			orderBy: [{ observedAt: 'desc' }],
		});

		if (links.length === 0) {
			return NextResponse.json({
				ok: true,
				successCount: 0,
				failCount: 0,
				skippedCount: 0,
				message: 'No store URLs available for scraping',
			});
		}

		const uniqueTargets: Record<string, ScrapeTarget> = {};
		for (const link of links) {
			const key = `${link.variantId}:${link.storeId}`;
			if (uniqueTargets[key]) continue;

			const pathOrUrl = (link.urlPathInStore ?? '').trim();
			const storeUrl = (link.store.url ?? '').trim();

			if (!pathOrUrl || !storeUrl) continue;

			uniqueTargets[key] = {
				variantId: link.variantId,
				storeId: link.storeId,
				url: toAbsoluteUrl(storeUrl, pathOrUrl),
			};
		}

		const targets = Object.values(uniqueTargets);
		if (targets.length === 0) {
			return NextResponse.json({
				ok: true,
				successCount: 0,
				failCount: 0,
				skippedCount: links.length,
				message: 'No valid targets with store URL and path found',
			});
		}

		const outcomes = await runWithConcurrency(targets, 4, async (target) => {
			try {
				await scrapeAndInsertExternalPrice(target.variantId, target.url);
				return { ok: true };
			} catch (error: any) {
				return {
					ok: false,
					variantId: target.variantId,
					storeId: target.storeId,
					message: error?.message || 'Scrape failed',
				};
			}
		});

		const successCount = outcomes.filter((outcome) => outcome.ok).length;
		const failItems = outcomes.filter((outcome) => !outcome.ok);

		return NextResponse.json({
			ok: true,
			successCount,
			failCount: failItems.length,
			skippedCount: links.length - targets.length,
			failures: failItems.slice(0, 20),
		});
	} catch (error: any) {
		console.error('Error scraping all prices:', error);
		return NextResponse.json(
			{ ok: false, message: error?.message || 'Failed to scrape all prices' },
			{ status: 500 }
		);
	}
}
