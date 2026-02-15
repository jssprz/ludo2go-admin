import { prisma } from '@jssprz/ludo2go-database';
import { PickupLocationsTable } from './pickup-locations-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function PickupLocationsPage() {
  const pickupLocations = await prisma.pickupLocation.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: {
          orders: true,
          customers: true,
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pickup Locations</h1>
          <p className="text-muted-foreground">
            Manage pickup locations for order fulfillment
          </p>
        </div>
        <Button asChild>
          <Link href="/pickup-locations/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Link>
        </Button>
      </div>

      <PickupLocationsTable pickupLocations={pickupLocations} />
    </div>
  );
}
