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
  });

  const locationStats = await prisma.inventory.groupBy({
    by: ['locationId'],
    where: { onHand: { gt: 0 } },
    _sum: {
      onHand: true,
    },
    _count: {
      variantId: true,
    },
  });

  const locationStatsMap = new Map(
    locationStats.map((row) => [
      row.locationId,
      {
        totalItems: row._sum.onHand,
        variantsCount: row._count.variantId,
      },
    ])
  );

  const ordersWithStats = locations.map((location) => ({
    ...location,
    totalItems: locationStatsMap.get(location.id)?.totalItems ?? 0,
    variantsCount: locationStatsMap.get(location.id)?.variantsCount ?? 0,
  }));

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

      <LocationsTable initialLocations={ordersWithStats as any} />
    </div>
  );
}
