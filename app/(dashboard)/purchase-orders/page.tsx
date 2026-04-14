import { prisma } from '@jssprz/ludo2go-database';
import { PurchaseOrdersTable } from './purchase-orders-table';

export const metadata = {
  title: 'Purchase Orders | Admin Dashboard',
  description: 'Manage purchase orders',
};

export default async function PurchaseOrdersPage() {
  const [orders, suppliers, variants] = await Promise.all([
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, product: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.productVariant.findMany({
      orderBy: { sku: 'asc' },
      select: {
        id: true,
        sku: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage purchase orders from suppliers.
          </p>
        </div>
      </div>

      <PurchaseOrdersTable
        initialOrders={orders as any}
        suppliers={suppliers}
        variants={variants as any}
      />
    </div>
  );
}
