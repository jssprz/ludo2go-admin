import { prisma } from '@jssprz/ludo2go-database';
import { PromoCodesTable } from './promo-codes-table';

export const metadata = {
  title: 'Promo Codes | Admin Dashboard',
  description: 'Manage promo code records',
};

export default async function PromoCodesPage() {
  const promoCodes = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage discounts, caps, and free shipping campaigns.
          </p>
        </div>
      </div>

      <PromoCodesTable initialPromoCodes={promoCodes} />
    </div>
  );
}
