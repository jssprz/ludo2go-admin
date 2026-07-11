import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { OrdersTable } from './orders-table';

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          variant: {
            select: {
              id: true,
              sku: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage customer orders and update their status
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/manual">
            <Plus className="h-4 w-4 mr-2" />
            Create Manual Order
          </Link>
        </Button>
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}
