import { prisma } from '@jssprz/ludo2go-database';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReceiveForm } from './receive-form';

export const metadata = { title: 'Recibir mercancía' };

const RECEIVABLE = new Set(['submitted', 'confirmed', 'partially_received']);

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Enviada',
  confirmed: 'Confirmada',
  partially_received: 'Recibida parcialmente',
};

export default async function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [order, locations] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, product: { select: { name: true } } },
            },
          },
          orderBy: { variantId: 'asc' },
        },
      },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (!order) notFound();
  if (!RECEIVABLE.has(order.status)) redirect(`/purchase-orders/${id}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/purchase-orders/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            OC {order.code}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recibir mercancía</h1>
          <p className="text-sm text-muted-foreground">
            {order.supplier.name} ·{' '}
            <Badge className="text-xs">{STATUS_LABELS[order.status] ?? order.status}</Badge>
          </p>
        </div>
      </div>

      <ReceiveForm
        orderId={id}
        orderCode={order.code}
        currency={order.currency}
        items={order.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          quantityReceived: i.quantityReceived,
          unitCost: i.unitCost,
          variant: i.variant,
        }))}
        locations={locations}
      />
    </div>
  );
}
