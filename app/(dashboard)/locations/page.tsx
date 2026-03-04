import { prisma } from '@jssprz/ludo2go-database';
import { LocationsTable } from './locations-table';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Inventory Locations | Admin Dashboard',
  description: 'Manage inventory locations',
};

export default async function LocationsPage() {
  const t = await getTranslations('locations');

  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { inventories: true },
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

      <LocationsTable initialLocations={locations as any} />
    </div>
  );
}
