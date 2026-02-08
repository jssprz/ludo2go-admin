import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TimelinesTable } from './timelines-table';

export default async function TimelinesPage() {
  const timelines = await prisma.gameTimeline.findMany({
    include: {
      events: {
        orderBy: [
          { year: 'desc' },
          { month: 'desc' }
        ]
      },
      gameDetails: {
        include: {
          product: true
        }
      }
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Game Timelines</h1>
          <p className="text-muted-foreground">
            Manage historical timelines for board games
          </p>
        </div>
        <Button asChild>
          <Link href="/timelines/new">Create Timeline</Link>
        </Button>
      </div>

      <TimelinesTable timelines={timelines} />
    </div>
  );
}
