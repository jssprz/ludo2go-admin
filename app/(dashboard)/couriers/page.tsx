import { prisma } from '@jssprz/ludo2go-database';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { CouriersManager } from './couriers-manager';

export const metadata = { title: 'Couriers' };

export default async function CouriersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  let couriers: { id: string; name: string; trackingUrlTemplate: string | null }[] = [];
  let loadError: string | null = null;
  try {
    couriers = await prisma.courier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, trackingUrlTemplate: true }
    });
  } catch {
    loadError = 'Failed to load couriers.';
  }

  return <CouriersManager couriers={couriers} loadError={loadError} />;
}