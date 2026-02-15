import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { PickupLocationForm } from '../../pickup-location-form';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditPickupLocationPage({ params }: Props) {
  const { id } = await params;

  const pickupLocation = await prisma.pickupLocation.findUnique({
    where: { id },
  });

  if (!pickupLocation) {
    notFound();
  }

  return <PickupLocationForm pickupLocation={pickupLocation} />;
}
