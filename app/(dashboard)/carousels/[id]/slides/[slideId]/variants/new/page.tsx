import { VariantForm } from '../../../../../variant-form';

type Props = {
  params: Promise<{ id: string; slideId: string }>;
};

export default async function NewVariantPage({ params }: Props) {
  const { id: carouselId, slideId } = await params;
  return <VariantForm carouselId={carouselId} slideId={slideId} />;
}
