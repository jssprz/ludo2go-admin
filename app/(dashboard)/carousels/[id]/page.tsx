import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { SlidesManager } from './slides-manager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CarouselDetailPage({ params }: Props) {
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: {
      slides: {
        orderBy: {
          position: 'asc',
        },
        include: {
          variants: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      },
    },
  });

  if (!carousel) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/carousels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {carousel.title || carousel.key}
            </h1>
            <Badge variant={carousel.isActive ? 'default' : 'secondary'}>
              {carousel.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage slides and variants for this carousel
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/carousels/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Carousel
          </Link>
        </Button>
      </div>

      {/* Carousel Info */}
      <Card>
        <CardHeader>
          <CardTitle>Carousel Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Key</div>
            <div className="font-mono text-sm font-medium">{carousel.key}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Placement</div>
            <div className="text-sm font-medium">
              {carousel.placement.replace(/_/g, ' ')}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Slides</div>
            <div className="text-sm font-medium">{carousel.slides.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Schedule</div>
            <div className="text-sm font-medium">
              {carousel.startAt || carousel.endAt ? 'Scheduled' : 'Always on'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slides Manager */}
      <SlidesManager carousel={carousel} />
    </div>
  );
}
