import { prisma } from '@jssprz/ludo2go-database';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import {
  ADMIN_TIME_ZONE_COOKIE,
  formatDateInTimeZone,
  normalizeTimeZone,
} from '@/lib/date-time';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const timeZone = normalizeTimeZone(cookieStore.get(ADMIN_TIME_ZONE_COOKIE)?.value);

  if (!id) {
    notFound();
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subtotal: true,
      tax: true,
      shipping: true,
      total: true,
      currency: true,
      notes: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          currency: true,
          variant: {
            select: {
              sku: true,
              edition: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          customizations: {
            select: {
              id: true,
              priceDelta: true,
              valueString: true,
              valueText: true,
              valueBoolean: true,
              valueDate: true,
              valueJson: true,
              group: true,
              option: true,
              selectedVariant: {
                select: {
                  sku: true,
                  product: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              selectedAddress: true,
            },
          },
        },
      },
      shippingAddr: true,
    },
  });

  if (!order) {
    notFound();
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  function formatDateTime(value: Date | string) {
    return formatDateInTimeZone(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      'en-US',
      timeZone
    );
  }

  function formatDate(value: Date | string) {
    return formatDateInTimeZone(
      value,
      { dateStyle: 'medium' },
      'en-US',
      timeZone
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/orders">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Order #{order.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            Created {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Status */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {formatDateTime(order.updatedAt)}
            </p>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="font-medium">
                {order.customer
                  ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || order.customer.email
                  : 'Guest / Missing customer'}
              </p>
              <p className="text-sm text-muted-foreground">{order.customer?.email ?? 'No email'}</p>
              {order.customer?.phone && (
                <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        {order.shippingAddr && (
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <p>{order.shippingAddr.line1}</p>
                {order.shippingAddr.line2 && <p>{order.shippingAddr.line2}</p>}
                <p>
                  {order.shippingAddr.city}
                  {order.shippingAddr.region && `, ${order.shippingAddr.region}`}
                  {order.shippingAddr.postalCode && ` ${order.shippingAddr.postalCode}`}
                </p>
                <p>{order.shippingAddr.country}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span>{formatCurrency(order.tax, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Shipping:</span>
              <span>{formatCurrency(order.shipping, order.currency)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total:</span>
              <span>{formatCurrency(order.total, order.currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.variant?.product?.name ?? 'Unknown product'}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU: {item.variant?.sku ?? '—'}
                    {item.variant?.edition && ` • ${item.variant.edition}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Quantity: {item.quantity}
                  </p>
                  {item.customizations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Customizations:
                      </p>
                      {item.customizations.map((customization) => {
                        const selectedValue =
                          customization.option?.label ??
                          (customization.selectedVariant
                            ? `${customization.selectedVariant.product?.name ?? 'Unknown product'} (${customization.selectedVariant.sku})`
                            : null) ??
                          (customization.selectedAddress
                            ? [
                                customization.selectedAddress.line1,
                                customization.selectedAddress.line2,
                                customization.selectedAddress.city,
                                customization.selectedAddress.region,
                                customization.selectedAddress.postalCode,
                                customization.selectedAddress.country,
                              ]
                                .filter(Boolean)
                                .join(', ')
                            : null) ??
                          customization.valueString ??
                          customization.valueText ??
                          (customization.valueBoolean !== null
                            ? customization.valueBoolean
                              ? 'Yes'
                              : 'No'
                            : null) ??
                          (customization.valueDate
                            ? formatDate(customization.valueDate)
                            : null) ??
                          (customization.valueJson
                            ? JSON.stringify(customization.valueJson)
                            : 'Selected');

                        return (
                          <p key={customization.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {customization.group.name}:
                            </span>{' '}
                            {selectedValue}
                            {customization.priceDelta !== 0 && (
                              <span className="ml-1">
                                ({customization.priceDelta > 0 ? '+' : '-'}
                                {formatCurrency(
                                  Math.abs(customization.priceDelta),
                                  item.currency
                                )})
                              </span>
                            )}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency(item.unitPrice * item.quantity, item.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.unitPrice, item.currency)} each
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
