import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { VariantForm } from '../../../../../../variant-form';

type Props = {
  params: Promise<{ id: string; slideId: string; variantId: string }>;
};

export default async function EditVariantPage({ params }: Props) {
  const { id: carouselId, slideId, variantId } = await params;

  const variant = await prisma.carouselSlideVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    notFound();
  }

  return <VariantForm carouselId={carouselId} slideId={slideId} variant={variant as any} />;
}
