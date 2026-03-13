import { prisma } from '@jssprz/ludo2go-database';
import { StoresTable } from './stores-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Stores | Admin Dashboard',
  description: 'Manage external stores for price comparison',
};

export default async function StoresPage() {
  const t = await getTranslations('stores');

  const stores = await prisma.store.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { prices: true },
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

      <StoresTable initialStores={stores as any} />
    </div>
  );
}
