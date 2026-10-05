import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@jssprz/ludo2go-database';
import { Button } from '@/components/ui/button';
import { buildPromotionCarouselContent } from '@/lib/promotion-carousel-content';
import { PromotionCarouselVariantForm } from './promotion-carousel-variant-form';

type PageProps = { params: Promise<{ id: string }> };

export default async function CreatePromotionCarouselVariantPage({ params }: PageProps) {
  const { id } = await params;
  const [promotion, carousels] = await Promise.all([
    prisma.promotion.findUnique({
      where: { id },
      include: { promoCodeLinks: { include: { promoCode: { select: { code: true } } } } },
    }),
    prisma.carousel.findMany({
      orderBy: [{ title: 'asc' }, { key: 'asc' }],
      select: {
        id: true,
        key: true,
        title: true,
        slides: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, name: true, isActive: true },
        },
      },
    }),
  ]);

  if (!promotion) notFound();

  const promotionContent = {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    status: promotion.status,
    activationMode: promotion.activationMode,
    conditions: promotion.conditions,
    benefits: promotion.benefits,
    currency: promotion.currency,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    usageLimit: promotion.usageLimit,
    usageCount: promotion.usageCount,
    perCustomerLimit: promotion.perCustomerLimit,
    promoCodes: promotion.promoCodeLinks.map((link) => link.promoCode.code),
  };
  const preview = buildPromotionCarouselContent(promotionContent);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/promotions" aria-label="Back to promotions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create carousel variant</h1>
          <p className="text-sm text-muted-foreground">Generated from {promotion.name}</p>
        </div>
      </div>
      <PromotionCarouselVariantForm
        promotionId={promotion.id}
        promotionName={promotion.name}
        promotionStatus={promotion.status}
        promotionStartsAt={promotion.startsAt?.toISOString() ?? null}
        promotionEndsAt={promotion.endsAt?.toISOString() ?? null}
        carousels={carousels}
        preview={preview}
      />
    </div>
  );
}