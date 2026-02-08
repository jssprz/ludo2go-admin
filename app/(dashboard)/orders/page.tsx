import { prisma } from '@jssprz/ludo2go-database';
import { OrdersTable } from './orders-table';

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
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
      shippingAddr: true,
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
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}
