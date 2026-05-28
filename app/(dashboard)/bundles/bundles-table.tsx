'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Pencil, Package } from 'lucide-react';

type BundleRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  brand: { id: string; name: string } | null;
  bundle: {
    bundleType: string;
    notes: string | null;
    items: Array<{ id: string }>;
    customizableDetails: { bundleProductId: string; pricingMode: string } | null;
  } | null;
};

type Props = {
  initialBundles: BundleRow[];
};

const BUNDLE_TYPE_LABELS: Record<string, string> = {
  game_accessory: 'Game + Accessory',
  game_game: 'Game + Game',
  accessory_accessory: 'Accessory + Accessory',
  merchandise: 'Merchandise',
  custom: 'Custom',
  customizable: 'Configurable',
};

const PRICING_MODE_LABELS: Record<string, string> = {
  fixed_price: 'Fixed Price',
  base_plus_options: 'Base + Options',
  options_only: 'Options Only',
};

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'default';
    case 'draft': return 'secondary';
    case 'archived': return 'outline';
    default: return 'secondary';
  }
}

export function BundlesTable({ initialBundles }: Props) {
  const [search, setSearch] = useState('');

  const filtered = initialBundles.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bundles</h1>
          <p className="text-muted-foreground text-sm">
            Manage fixed and configurable product bundles.
          </p>
        </div>
        <Link href="/products/new?kind=bundle">
          <Button size="sm">
            <Package className="mr-2 h-4 w-4" />
            New Bundle
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search bundles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bundle Type</TableHead>
              <TableHead className="text-center">Fixed Items</TableHead>
              <TableHead>Configurable?</TableHead>
              <TableHead>Pricing Mode</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No bundles found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((bundle) => (
              <TableRow key={bundle.id}>
                <TableCell className="font-medium">{bundle.name}</TableCell>
                <TableCell>{bundle.brand?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(bundle.status) as any}>
                    {bundle.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {bundle.bundle
                    ? (BUNDLE_TYPE_LABELS[bundle.bundle.bundleType] ?? bundle.bundle.bundleType)
                    : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {bundle.bundle?.items.length ?? 0}
                </TableCell>
                <TableCell>
                  {bundle.bundle?.customizableDetails ? (
                    <Badge variant="default">Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {bundle.bundle?.customizableDetails
                    ? (PRICING_MODE_LABELS[bundle.bundle.customizableDetails.pricingMode] ?? bundle.bundle.customizableDetails.pricingMode)
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/bundles/${bundle.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit Bundle
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
