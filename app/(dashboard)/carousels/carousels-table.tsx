'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Eye, Copy } from 'lucide-react';
import Link from 'next/link';

type Carousel = {
  id: string;
  key: string;
  placement: string;
  title: string | null;
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
  _count: {
    slides: number;
  };
};

type Props = {
  carousels: Carousel[];
};

export function CarouselsTable({ carousels }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredCarousels = carousels.filter((carousel) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      carousel.key.toLowerCase().includes(searchLower) ||
      carousel.title?.toLowerCase().includes(searchLower) ||
      carousel.placement.toLowerCase().includes(searchLower)
    );
  });

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this carousel? All slides and variants will be deleted.')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/carousels/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete carousel');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/carousels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update carousel');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/carousels/${id}/duplicate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to duplicate carousel');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  function getPlacementBadge(placement: string) {
    const colors: Record<string, string> = {
      HOME_MAIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      HOME_SECONDARY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    return colors[placement] || colors.OTHER;
  }

  function formatPlacement(placement: string) {
    return placement.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  if (carousels.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No carousels found. Create your first carousel to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search by key, title, or placement..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Slides</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCarousels.map((carousel) => {
              const isScheduled = carousel.startAt || carousel.endAt;
              const now = new Date();
              const isScheduledActive = 
                (!carousel.startAt || carousel.startAt <= now) &&
                (!carousel.endAt || carousel.endAt >= now);

              return (
                <TableRow key={carousel.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {carousel.key}
                  </TableCell>
                  <TableCell>
                    {carousel.title || <span className="text-muted-foreground italic">No title</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={getPlacementBadge(carousel.placement)}>
                      {formatPlacement(carousel.placement)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(carousel.id, carousel.isActive)}
                      className="cursor-pointer"
                    >
                      <Badge
                        variant={carousel.isActive ? 'default' : 'secondary'}
                        className={
                          carousel.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }
                      >
                        {carousel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    {isScheduled ? (
                      <div className="text-xs">
                        {carousel.startAt && (
                          <div>From: {carousel.startAt.toLocaleDateString()}</div>
                        )}
                        {carousel.endAt && (
                          <div>To: {carousel.endAt.toLocaleDateString()}</div>
                        )}
                        {!isScheduledActive && (
                          <Badge variant="secondary" className="mt-1">
                            Not in range
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Always on</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {carousel._count.slides}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/carousels/${carousel.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View & Manage Slides
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/carousels/${carousel.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Carousel
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(carousel.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(carousel.id, carousel.isActive)}
                        >
                          {carousel.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(carousel.id)}
                          disabled={deletingId === carousel.id}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredCarousels.length === 0 && searchQuery && (
        <p className="text-center text-muted-foreground py-4">
          No carousels found matching "{searchQuery}"
        </p>
      )}
    </div>
  );
}
