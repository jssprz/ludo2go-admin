import { prisma } from '@jssprz/ludo2go-database';
import { AccessoryCategoriesTable } from './accessory-categories-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Accessory Categories | Admin Dashboard',
  description: 'Manage accessory categories',
};

export default async function AccessoryCategoriesPage() {
  const t = await getTranslations('accessoryCategories');
  
  const categories = await prisma.accessoryCategory.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: {
        select: { accessories: true },
      },
    },
  });

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

      <AccessoryCategoriesTable initialCategories={categories as any} />
    </div>
  );
}
