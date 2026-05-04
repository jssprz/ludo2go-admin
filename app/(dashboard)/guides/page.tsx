import { prisma } from '@jssprz/ludo2go-database';
import { GuidesTable } from './guides-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Guides | Admin Dashboard',
  description: 'Manage guides',
};

export default async function GuidesPage() {
  const t = await getTranslations('guides');

  const [guides, categories] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <GuidesTable initialGuides={guides as any} categories={categories} />
    </div>
  );
}