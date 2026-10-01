import { prisma } from '@jssprz/ludo2go-database';
import { PromotionsTable } from './promotions-table';

export const metadata = {
  title: 'Promociones',
  description: 'Manage promotion rules and campaigns',
};

export default async function PromotionsPage() {
  const [promotions, promoCodes] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        promoCodeLinks: {
          include: {
            promoCode: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    }),
    prisma.promoCode.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        promotionLink: {
          select: {
            promotionId: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Configure automatic and promo-code driven promotion rules, benefits, and conditions.
          </p>
        </div>
      </div>

      <PromotionsTable
        initialPromotions={promotions as any}
        allPromoCodes={promoCodes}
      />
    </div>
  );
}
