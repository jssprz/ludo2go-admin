'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Check, X, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ScheduledVariant {
  id: string;
  sku: string;
  edition: string | null;
  language: string;
  condition: string;
  status: string;
  displayTitleShort: string | null;
  activeAtScheduled: Date | string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  };
  prices: {
    amount: any;
    currency: string;
    type: string;
  }[];
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toInputDate(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function PresaleRow({ variant }: { variant: ScheduledVariant }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [dateValue, setDateValue] = useState(toInputDate(variant.activeAtScheduled));
  const [isPending, startTransition] = useTransition();

  async function saveDate() {
    startTransition(async () => {
      try {
        await fetch(`/api/variants/${variant.id}/schedule`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeAtScheduled: dateValue || null }),
        });
        setIsEditing(false);
        router.refresh();
      } catch (err) {
        console.error('Failed to update schedule date', err);
      }
    });
  }

  async function removeFromPresale() {
    if (!confirm('Remove this variant from pre-sale? Its status will be set to draft.')) return;
    startTransition(async () => {
      try {
        await fetch(`/api/variants/${variant.id}/schedule`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'draft', activeAtScheduled: null }),
        });
        router.refresh();
      } catch (err) {
        console.error('Failed to remove from presale', err);
      }
    });
  }

  const price = variant.prices[0];
  const isOverdue =
    variant.activeAtScheduled && new Date(variant.activeAtScheduled) < new Date();

  return (
    <TableRow>
      <TableCell className="font-medium max-w-[200px]">
        <Link
          href={`/products/${variant.product.id}/edit`}
          className="hover:underline text-primary"
        >
          {variant.product.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
      <TableCell>{variant.displayTitleShort || variant.edition || '—'}</TableCell>
      <TableCell className="uppercase text-xs">{variant.language}</TableCell>
      <TableCell>
        {price
          ? `${price.currency} ${Number(price.amount).toLocaleString()}`
          : '—'}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-8 w-[160px] text-sm"
              disabled={isPending}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={saveDate}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setDateValue(toInputDate(variant.activeAtScheduled));
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
            onClick={() => setIsEditing(true)}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              {formatDate(variant.activeAtScheduled)}
            </span>
          </button>
        )}
      </TableCell>
      <TableCell>
        {isOverdue ? (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs capitalize">
            Scheduled
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="h-7 px-2">
            <Link href={`/variants/${variant.id}/edit`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-500 hover:text-red-700"
            onClick={removeFromPresale}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PresaleTable({ variants }: { variants: ScheduledVariant[] }) {
  if (variants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Variants</CardTitle>
          <CardDescription>
            No variants are currently scheduled for pre-sale.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Scheduled Variants
          <Badge variant="secondary" className="ml-2 text-xs">
            {variants.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Click the date to edit it inline. Overdue dates are highlighted in red.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => (
              <PresaleRow key={v.id} variant={v} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
