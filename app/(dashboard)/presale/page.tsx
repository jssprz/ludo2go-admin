import { prisma } from '@jssprz/ludo2go-database';
import { PresaleTable } from './presale-table';
import { SetPresaleForm } from './set-presale-form';

export default async function PresalePage() {
  const [scheduledVariants, allProducts] = await Promise.all([
    prisma.productVariant.findMany({
      where: { status: 'scheduled' },
      include: {
        product: {
          select: { id: true, name: true, slug: true },
        },
        prices: {
          where: { active: true },
          orderBy: { type: 'asc' },
          take: 1,
        },
      },
      orderBy: { activeAtScheduled: 'asc' },
    }),
    // For searching variants in the "Set PreSale" form, we only need a small set
    prisma.product.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-Sale Management</h1>
        <p className="text-muted-foreground">
          Manage scheduled variant releases and set new pre-sales.
        </p>
      </div>

      <SetPresaleForm />

      <PresaleTable variants={scheduledVariants} />
    </div>
  );
}
