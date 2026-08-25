'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ImageOff, ChevronDown, ChevronRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { deleteProduct } from './actions';
import { useState } from 'react';
import Link from 'next/link';
import { ProductStatus, ProductKind } from '@prisma/client';
import { useRouter } from 'next/navigation';

type AuditUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
} | null;

type SelectVariant = {
  id: string;
  sku: string;
  edition: string | null;
  language: string | null;
  status: string;
  condition: string;
  activeAtScheduled: Date | null;
  prices: { id: string; type: string; amount: number; currency: string }[];
  inventory: { onHand: number; reserved: number }[];
};

export interface SelectProduct {
  id: string;
  name: string;
  kind: ProductKind;
  bggId: number | null;
  bgg: { id: number | null } | null;
  status: ProductStatus;
  shortDescription: string | null;
  description: string | null;
  tags: string[];
  brand: { name: string; slug: string } | null;
  createdAt: Date;
  mediaLinks: { role: string | null; media: { url: string } }[];
  variants: SelectVariant[];
  productViews: number;
  topVariantRelevance?: {
    variantId: string;
    sku: string;
    unitsSoldInWindow: number;
    viewCount: number;
    clicks: number;
    impressions: number;
    inCartsQuantity: number;
    daysSinceActivated: number | null;
    rating: number | null;
    bggRating: number | null;
    reviewRating: number;
    reviewCount: number;
    bggRank: number | null;
  } | null;
  createdByAdminUser: AuditUser;
  updatedByAdminUser: AuditUser;
}

const PRICE_TYPE_LABELS: Record<string, string> = {
  msrp: 'MSRP',
  retail: 'Retail',
  sale: 'Sale',
  member: 'Member',
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'CLP' ? 'es-CL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

// Total table column count (must match products-table.tsx header)
const TOTAL_COLUMNS = 19;

export function ProductRow({ product }: { product: SelectProduct }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const primaryMediaLink =
    product.mediaLinks.find((mediaLink) => mediaLink.role === 'primary') ??
    product.mediaLinks[0];

  const totalStock = product.variants.reduce(
    (sum, v) => sum + v.inventory.reduce(
      (s, inv) => s + Math.max(0, inv.onHand - inv.reserved),
      0
    ),
    0
  );

  return (
    <>
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/products/${product.id}/edit`)}
    >
      <TableCell className="hidden sm:table-cell px-2">
        {primaryMediaLink ? (
          <Image
            alt="Product image"
            className="aspect-square rounded-md object-cover"
            height="64"
            src={primaryMediaLink.media.url}
            width="64"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      <TableCell className="px-2">
        <div className="flex items-start gap-1.5">
          {product.variants.length > 0 && (
            <button
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              aria-label={expanded ? 'Collapse variants' : 'Expand variants'}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <div>
            <div className="font-medium">{product.name}</div>
            {product.shortDescription && (
              <div className="text-xs text-muted-foreground line-clamp-2">{product.shortDescription}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground  px-2">
        <div className="tabular-nums">{product.bgg?.id ?? product.bggId ?? '—'}</div>
        <div className="text-xs">
          Score: {product.topVariantRelevance?.bggRating != null ? product.topVariantRelevance.bggRating.toFixed(2) : '—'}
        </div>
        <div className="text-xs">
          Rank: {product.topVariantRelevance?.bggRank ?? '—'}
        </div>
      </TableCell>
      <TableCell className="px-2">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="capitalize w-fit">
            {product.status}
          </Badge>
          {(() => {
            const uniqueVariantStatuses = Array.from(new Set(product.variants.map((v) => v.status)));
            return uniqueVariantStatuses.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {uniqueVariantStatuses.map((s) => (
                  <Badge
                    key={s}
                    variant={s === 'active' ? 'default' : s === 'discontinued' || s === 'archived' ? 'destructive' : 'secondary'}
                    className="capitalize text-[10px] px-1 py-0 h-4 w-fit font-normal opacity-80"
                  >
                    {s.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell px-2">
        <Badge variant="secondary" className="capitalize">
          {product.kind}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground px-2">
        {product.brand?.name ?? '—'}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-right px-2">{Number(product.productViews ?? 0)}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{product.topVariantRelevance?.unitsSoldInWindow ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{Math.round(product.topVariantRelevance?.clicks ?? 0)}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{Math.round(product.topVariantRelevance?.impressions ?? 0)}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{product.topVariantRelevance?.inCartsQuantity ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{product.topVariantRelevance?.daysSinceActivated ?? '—'}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">{product.topVariantRelevance?.reviewCount ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right px-2">
        {(product.topVariantRelevance?.reviewRating ?? 0).toFixed(2)}
      </TableCell>
      <TableCell className="hidden md:table-cell px-2">{totalStock}</TableCell>
      <TableCell className="hidden md:table-cell px-2">
        {product.createdAt.toLocaleDateString("en-US")}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs px-2">
        {product.createdByAdminUser
          ? (product.createdByAdminUser.firstName && product.createdByAdminUser.lastName
            ? `${product.createdByAdminUser.firstName} ${product.createdByAdminUser.lastName}`
            : product.createdByAdminUser.username ?? '—')
          : '—'}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs px-2">
        {product.updatedByAdminUser
          ? (product.updatedByAdminUser.firstName && product.updatedByAdminUser.lastName
            ? `${product.updatedByAdminUser.firstName} ${product.updatedByAdminUser.lastName}`
            : product.updatedByAdminUser.username ?? '—')
          : '—'}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <Link href={`/products/${product.id}/edit`}>
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>
              <form action={deleteProduct}>
                <button type="submit">Delete</button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
    {expanded && product.variants.length > 0 && (
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={TOTAL_COLUMNS} className="py-2 px-4">
          <div className="space-y-1.5">
            {product.variants.map((v) => {
              const onHand = v.inventory.reduce((s, inv) => s + inv.onHand, 0);
              const reserved = v.inventory.reduce((s, inv) => s + inv.reserved, 0);
              const available = onHand - reserved;
              return (
                <div
                  key={v.id}
                  className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border rounded-md bg-background px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); router.push(`/variants/${v.id}/edit`); }}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-sm font-medium">
                      {v.sku}
                      {v.edition && (
                        <span className="text-xs text-muted-foreground ml-1">({v.edition})</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.language ? `${v.language} · ` : ''}
                      {v.status} · {v.condition}
                      {v.status === 'scheduled' && v.activeAtScheduled && (
                        <> · activates {new Date(v.activeAtScheduled).toLocaleString()}</>
                      )}
                    </div>
                    {v.prices.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {v.prices.map((p) => (
                          <Badge key={p.id} variant={p.type === 'sale' ? 'destructive' : 'secondary'} className="text-xs font-normal">
                            {PRICE_TYPE_LABELS[p.type] ?? p.type}: {formatPrice(p.amount, p.currency)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 pt-0.5">No prices set</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs min-w-[80px]">
                      {v.inventory.length > 0 ? (
                        <>
                          <span className={available > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {available} avail
                          </span>
                          <span className="text-muted-foreground"> / {onHand} on hand</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No stock</span>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/variants/${v.id}/edit`}>Edit variant</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TableCell>
      </TableRow>
    )}
    </>
  );
}
