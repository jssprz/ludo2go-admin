import { prisma } from '@jssprz/ludo2go-database';
import { notFound } from 'next/navigation';
import { TimelineForm } from '../../timeline-form';

type PageProps = {
  params: Promise<{
    timelineId: string;
  }>;
};

export default async function EditTimelinePage({ params }: PageProps) {
  const { timelineId } = await params;
  const [timeline, variants] = await Promise.all([
    prisma.gameTimeline.findUnique({
      where: { id: timelineId },
      include: {
        events: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
          include: {
            linkedVariant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    }),
    prisma.productVariant.findMany({
      include: {
        product: true,
      },
      orderBy: [
        { product: { name: 'asc' } },
        { sku: 'asc' },
      ],
    }),
  ]);

  if (!timeline) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Timeline</h1>
        <p className="text-muted-foreground">
          Edit timeline events and details
        </p>
      </div>

      <TimelineForm timeline={timeline} variants={variants} />
    </div>
  );
}
