import { prisma } from '@jssprz/ludo2go-database';
import { TimelineForm } from '../timeline-form';

export default async function NewTimelinePage() {
  // Fetch all variants with their products
  const variants = await prisma.productVariant.findMany({
    include: {
      product: true,
    },
    orderBy: [
      { product: { name: 'asc' } },
      { sku: 'asc' },
    ],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Timeline</h1>
        <p className="text-muted-foreground">
          Create a new historical timeline for a board game
        </p>
      </div>

      <TimelineForm variants={variants} />
    </div>
  );
}
