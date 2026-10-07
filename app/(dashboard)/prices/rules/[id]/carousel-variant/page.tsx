import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@jssprz/ludo2go-database';
import { Button } from '@/components/ui/button';
import { buildPriceRuleCarouselContent } from '@/lib/price-rule-carousel-content';
import { PriceRuleCarouselVariantForm } from './price-rule-carousel-variant-form';

type PageProps = { params: Promise<{ id: string }> };

export default async function CreatePriceRuleCarouselVariantPage({ params }: PageProps) {
  const { id } = await params;
  const [rule, carousels] = await Promise.all([
    prisma.variantPriceRule.findUnique({ where: { id } }),
    prisma.carousel.findMany({
      orderBy: [{ title: 'asc' }, { key: 'asc' }],
      select: {
        id: true, key: true, title: true,
        slides: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, name: true, isActive: true },
        },
      },
    }),
  ]);
  if (!rule) notFound();

  const preview = buildPriceRuleCarouselContent({
    id: rule.id, name: rule.name, badge: rule.badge, description: rule.description,
    active: rule.active, applied: rule.applied, startsAt: rule.startsAt, endsAt: rule.endsAt,
    currency: rule.currency, sourcePriceType: rule.sourcePriceType,
    computationType: rule.computationType, fixedAmount: rule.fixedAmount,
    percentageDiscount: rule.percentageDiscount?.toString() ?? null,
    fixedDiscountAmount: rule.fixedDiscountAmount,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/prices" aria-label="Back to prices"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create carousel variant</h1>
          <p className="text-sm text-muted-foreground">Generated from {rule.name}</p>
        </div>
      </div>
      <PriceRuleCarouselVariantForm
        ruleId={rule.id}
        ruleActive={rule.active && rule.applied}
        carousels={carousels}
        preview={preview}
      />
    </div>
  );
}