'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GameTimeline, GameTimelineEvent, GameDetails, Product } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type TimelineWithDetails = GameTimeline & {
  events: GameTimelineEvent[];
  gameDetails: (GameDetails & { product: Product })[];
};

type Props = {
  timelines: TimelineWithDetails[];
};

export function TimelinesTable({ timelines }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this timeline? This will unlink it from all games.')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/timelines/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete timeline');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    } finally {
      setDeletingId(null);
    }
  }

  if (timelines.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No timelines found. Create your first one!
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Linked Games</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timelines.map((timeline) => (
            <TableRow key={timeline.id}>
              <TableCell className="font-mono text-xs">
                {timeline.id}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Badge variant="outline">
                    {timeline.events.length} event{timeline.events.length !== 1 ? 's' : ''}
                  </Badge>
                  {timeline.events.some(e => e.linkedVariantId) && (
                    <Badge variant="outline" className="text-xs">
                      {timeline.events.filter(e => e.linkedVariantId).length} linked
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {timeline.gameDetails.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    {timeline.gameDetails.map((gd) => (
                      <Link
                        key={gd.productId}
                        href={`/products/${gd.productId}/edit`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {gd.product.name}
                      </Link>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/timelines/${timeline.id}/edit`}>
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(timeline.id)}
                    disabled={deletingId === timeline.id}
                  >
                    {deletingId === timeline.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
