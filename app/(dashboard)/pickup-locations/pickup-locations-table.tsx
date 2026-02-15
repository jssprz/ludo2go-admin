'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PickupLocation } from '@prisma/client';
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
import { MoreHorizontal, Pencil, Trash2, MapPin } from 'lucide-react';
import Link from 'next/link';

type PickupLocationWithCounts = PickupLocation & {
  _count: {
    orders: number;
    customers: number;
  };
};

type Props = {
  pickupLocations: PickupLocationWithCounts[];
};

export function PickupLocationsTable({ pickupLocations }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter locations by search query
  const filteredLocations = pickupLocations.filter((location) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      location.name.toLowerCase().includes(searchLower) ||
      location.code.toLowerCase().includes(searchLower) ||
      location.city.toLowerCase().includes(searchLower) ||
      location.country.toLowerCase().includes(searchLower) ||
      location.addressLine1.toLowerCase().includes(searchLower)
    );
  });

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this pickup location?')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/pickup-locations/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete pickup location');
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
      const res = await fetch(`/api/pickup-locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update pickup location');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  if (pickupLocations.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No pickup locations found. Create your first location to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search by name, code, city, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City / Country</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Customers</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLocations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-mono text-xs">
                  {location.code}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{location.name}</div>
                  {location.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {location.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{location.addressLine1}</div>
                  {location.addressLine2 && (
                    <div className="text-xs text-muted-foreground">
                      {location.addressLine2}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{location.city}</div>
                  {location.region && (
                    <div className="text-xs text-muted-foreground">
                      {location.region}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {location.country}
                  </div>
                </TableCell>
                <TableCell>
                  {location.phone ? (
                    <div className="text-sm">{location.phone}</div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                  {(location.lat && location.lng) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>GPS</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(location.id, location.isActive)}
                    className="cursor-pointer"
                  >
                    <Badge
                      variant={location.isActive ? 'default' : 'secondary'}
                      className={
                        location.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }
                    >
                      {location.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  {location._count.orders}
                </TableCell>
                <TableCell className="text-right">
                  {location._count.customers}
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
                        <Link href={`/pickup-locations/${location.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(location.id, location.isActive)}
                      >
                        {location.isActive ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(location.id)}
                        disabled={deletingId === location.id || location._count.orders > 0}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                      {location._count.orders > 0 && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                          Cannot delete: has orders
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredLocations.length === 0 && searchQuery && (
        <p className="text-center text-muted-foreground py-4">
          No locations found matching "{searchQuery}"
        </p>
      )}
    </div>
  );
}
