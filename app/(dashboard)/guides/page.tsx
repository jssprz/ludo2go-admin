import { prisma } from '@jssprz/ludo2go-database';
import { EventType } from '@prisma/client';
import { GuidesTable } from './guides-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Guides | Admin Dashboard',
  description: 'Manage guides',
};

export default async function GuidesPage() {
  const t = await getTranslations('guides');

  const [guides, categories, pageViewEvents] = await Promise.all([
    prisma.guide.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { blocks: true, variants: true },
        },
      },
    }),
    prisma.guideCategory.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.event.findMany({
      where: { eventType: EventType.page_view },
      select: { properties: true },
    }),
  ]);

  // Count visits per guide
  const visitsByGuideId = new Map<string, number>();
  for (const event of pageViewEvents) {
    if (!event.properties || typeof event.properties !== 'object') continue;
    const props = event.properties as { guideId?: unknown };
    if (typeof props.guideId === 'string') {
      visitsByGuideId.set(props.guideId, (visitsByGuideId.get(props.guideId) ?? 0) + 1);
    }
  }

  // Enrich guides with visit counts
  const guidesWithVisits = guides.map(guide => ({
    ...guide,
    visits: visitsByGuideId.get(guide.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <GuidesTable initialGuides={guidesWithVisits as any} categories={categories} />
    </div>
  );
}