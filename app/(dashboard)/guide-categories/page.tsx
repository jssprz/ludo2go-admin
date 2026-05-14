import { prisma } from '@jssprz/ludo2go-database';
import { GuideCategoriesTable } from './guide-categories-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Guide Categories | Admin Dashboard',
  description: 'Manage guide categories',
};

export default async function GuideCategoriesPage() {
  const t = await getTranslations('guideCategories');

  const categories = await prisma.guideCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { guides: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
      </div>

      <GuideCategoriesTable initialCategories={categories as any} />
    </div>
  );
}