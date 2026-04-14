import { prisma } from '@jssprz/ludo2go-database';
import { SuppliersTable } from './suppliers-table';

export const metadata = {
  title: 'Suppliers | Admin Dashboard',
  description: 'Manage suppliers and cost tracking',
};

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { costPrices: true, purchaseOrders: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage suppliers, contact info, and payment terms.
          </p>
        </div>
      </div>

      <SuppliersTable initialSuppliers={suppliers as any} />
    </div>
  );
}
