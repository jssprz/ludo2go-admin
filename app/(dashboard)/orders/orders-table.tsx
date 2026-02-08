'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, Customer, OrderItem, ProductVariant, Product, Address, OrderStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OrderWithDetails = Order & {
  customer: Pick<Customer, 'id' | 'email' | 'firstName' | 'lastName'>;
  items: (OrderItem & {
    variant: ProductVariant & {
      product: Pick<Product, 'id' | 'name'>;
    };
  })[];
  shippingAddr: Address | null;
};

type Props = {
  orders: OrderWithDetails[];
};

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function OrdersTable({ orders }: Props) {
  const router = useRouter();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update order status');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency,
    }).format(amount); // Convert from minor units
  }

  function getCustomerName(customer: OrderWithDetails['customer']) {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email;
  }

  if (orders.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No orders found.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs">
                {order.id.slice(0, 8)}...
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {getCustomerName(order.customer)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.customer.email}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {order.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="text-xs">
                      {item.quantity}x {item.variant.product.name}
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{order.items.length - 2} more
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(order.total, order.currency)}
              </TableCell>
              <TableCell>
                <Select
                  value={order.status}
                  onValueChange={(value) =>
                    handleStatusChange(order.id, value as OrderStatus)
                  }
                  disabled={updatingOrderId === order.id}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue>
                      <Badge className={STATUS_COLORS[order.status]}>
                        {order.status}
                      </Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
