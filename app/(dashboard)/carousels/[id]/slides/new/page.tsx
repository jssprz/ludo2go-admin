import { SlideForm } from '../../../slide-form';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewSlidePage({ params }: Props) {
  const { id: carouselId } = await params;
  return <SlideForm carouselId={carouselId} />;
}
