import { prisma } from '@jssprz/ludo2go-database';
import { InventoryTable } from './inventory-table';

export default async function InventoryPage() {
  // Fetch all variants with their inventory and product info
  const [variants, locations] = await Promise.all([
    prisma.productVariant.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        inventory: {
          include: {
            location: true,
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { sku: 'asc' },
      ],
    }),
    prisma.location.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage stock levels across all variants and locations
          </p>
        </div>
      </div>

      <InventoryTable variants={variants} locations={locations} />
    </div>
  );
}
