import { prisma } from '@jssprz/ludo2go-database';
import { CarouselsTable } from './carousels-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function CarouselsPage() {
  const carousels = await prisma.carousel.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: {
          slides: true,
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carousels</h1>
          <p className="text-muted-foreground">
            Manage carousels, slides, and their variants for your storefront
          </p>
        </div>
        <Button asChild>
          <Link href="/carousels/new">
            <Plus className="mr-2 h-4 w-4" />
            New Carousel
          </Link>
        </Button>
      </div>

      <CarouselsTable carousels={carousels} />
    </div>
  );
}
