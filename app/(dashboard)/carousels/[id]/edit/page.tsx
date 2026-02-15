import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { CarouselForm } from '../../carousel-form';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCarouselPage({ params }: Props) {
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
  });

  if (!carousel) {
    notFound();
  }

  return <CarouselForm carousel={carousel as any} />;
}
