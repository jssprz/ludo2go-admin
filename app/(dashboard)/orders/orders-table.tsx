'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FulfillmentMethod, OrderStatus } from '@prisma/client';
import { ChevronDown, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type OrderWithDetails = {
  id: string;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  total: number;
  profit: number | null;
  currency: string;
  createdAt: Date;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    variantId: string;
    unitPrice: number;
    currency: string;
    isGift: boolean;
    cancellations: Array<{ quantity: number }>;
    variant: {
      id: string;
      sku: string;
      mediaLinks: Array<{
        media: {
          url: string;
        };
      }>;
      product: {
        id: string;
        name: string;
        mediaLinks: Array<{
          media: {
            url: string;
          };
        }>;
      } | null;
    } | null;
  }>;
};

type Props = {
  orders: OrderWithDetails[];
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  ready_to_ship: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function OrdersTable({ orders }: Props) {
  const router = useRouter();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OrderStatus>>(() => new Set(ORDER_STATUSES.filter((status) => status !== 'cancelled')));
  const visibleOrders = useMemo(() => orders.filter((order) => selectedStatuses.has(order.status)), [orders, selectedStatuses]);
  const deliveredGainByCurrency = useMemo(() => {
    const totals = new Map<string, { amount: number; unavailable: number }>();
    for (const order of orders) {
      if (order.status !== 'delivered') continue;
      const total = totals.get(order.currency) ?? { amount: 0, unavailable: 0 };
      if (order.profit === null) {
        total.unavailable += 1;
      } else {
        total.amount += order.profit;
      }
      totals.set(order.currency, total);
    }
    return Array.from(totals.entries());
  }, [orders]);

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
    if (!customer) {
      return 'Guest / Missing customer';
    }

    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Delivered orders estimated gain</h2>
          {deliveredGainByCurrency.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {deliveredGainByCurrency.map(([currency, total]) => (
                <span key={currency} className="text-sm">
                  {formatCurrency(total.amount, currency)}
                  {total.unavailable > 0 && <span className="ml-1 text-muted-foreground">({total.unavailable} unavailable)</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No delivered orders.</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <Filter className="mr-2 h-4 w-4" />
              Status ({selectedStatuses.size}/{ORDER_STATUSES.length})
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Show orders with status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ORDER_STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={selectedStatuses.has(status)}
                onCheckedChange={(checked) => {
                  setSelectedStatuses((current) => {
                    const next = new Set(current);
                    if (checked) {
                      next.add(status);
                    } else {
                      next.delete(status);
                    }
                    return next;
                  });
                }}
                onSelect={(event) => event.preventDefault()}
              >
                {status.replaceAll('_', ' ')}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {visibleOrders.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">No orders match the selected statuses.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estimated gain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{getCustomerName(order.customer)}</span>
                      <span className="text-xs text-muted-foreground">{order.customer?.email ?? 'No email'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{order.fulfillmentMethod === 'pickup' ? 'Retiro' : 'Entrega'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {order.items.slice(0, 2).map((item) => (
                        <div key={item.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            {(item.variant?.mediaLinks?.[0]?.media.url ?? item.variant?.product?.mediaLinks?.[0]?.media.url) && (
                              <img src={item.variant?.mediaLinks?.[0]?.media.url ?? item.variant?.product?.mediaLinks?.[0]?.media.url} alt={item.variant?.product?.name ?? item.variant?.sku ?? 'Item'} className="h-7 w-7 rounded object-cover border" />
                            )}
                            <span>
                              {item.quantity}x {item.variant?.product?.name ?? item.variant?.sku ?? 'Unknown variant'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 2 && <span className="text-xs text-muted-foreground">+{order.items.length - 2} more</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(order.total, order.currency)}</TableCell>
                  <TableCell className="font-medium">{order.profit === null ? <span className="text-muted-foreground">Unavailable</span> : formatCurrency(order.profit, order.currency)}</TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)} disabled={updatingOrderId === order.id}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
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
                      <span className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</span>
                      <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/orders/${order.id}`)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
