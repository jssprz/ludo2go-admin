import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { SlideForm } from '../../../../slide-form';

type Props = {
  params: Promise<{ id: string; slideId: string }>;
};

export default async function EditSlidePage({ params }: Props) {
  const { id: carouselId, slideId } = await params;

  const slide = await prisma.carouselSlide.findUnique({
    where: { id: slideId },
  });

  if (!slide) {
    notFound();
  }

  return <SlideForm carouselId={carouselId} slide={slide as any} />;
}
