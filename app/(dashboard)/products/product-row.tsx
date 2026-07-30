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
import { MoreHorizontal, ImageOff } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { deleteProduct } from './actions';
import { ProductStatus, ProductKind } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type AuditUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
} | null;

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
  variants: any[];
  productViews: number;
  productViewsLast7d: number;
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
    reviewCount: number;
    bggRank: number | null;
    relevanceScore: number;
  } | null;
  createdByAdminUser: AuditUser;
  updatedByAdminUser: AuditUser;
}

export function ProductRow({ product }: { product: SelectProduct }) {
  const router = useRouter();
  const primaryMediaLink =
    product.mediaLinks.find((mediaLink) => mediaLink.role === 'primary') ??
    product.mediaLinks[0];
  
  // Total stock across all locations
  const totalStock = product.variants.reduce(
    (sum: number, v: any) => sum + (v.inventory.reduce(
      (sum: number, inv: any) => sum + Math.max(0, inv.onHand - inv.reserved),
      0
    )),
    0
  );

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/products/${product.id}/edit`)}
    >
      <TableCell className="hidden sm:table-cell">
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
      <TableCell>
        <div className="font-medium">{product.name}</div>
        {product.shortDescription && (
          <div className="text-xs text-muted-foreground line-clamp-2">{product.shortDescription}</div>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
        {product.bgg?.id ?? product.bggId ?? '—'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {product.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="secondary" className="capitalize">
          {product.kind}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {product.brand?.name ?? '—'}
      </TableCell>
      <TableCell className="hidden md:table-cell">{product.variants.length}</TableCell>
      <TableCell className="hidden sm:table-cell">{product.productViews}</TableCell>
      <TableCell className="hidden sm:table-cell">{product.productViewsLast7d}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{product.topVariantRelevance?.unitsSoldInWindow ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{Math.round(product.topVariantRelevance?.clicks ?? 0)}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{Math.round(product.topVariantRelevance?.impressions ?? 0)}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{product.topVariantRelevance?.inCartsQuantity ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{product.topVariantRelevance?.daysSinceActivated ?? '—'}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">
        {product.topVariantRelevance?.rating != null ? product.topVariantRelevance.rating.toFixed(2) : '—'}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-right">{product.topVariantRelevance?.reviewCount ?? 0}</TableCell>
      <TableCell className="hidden xl:table-cell text-right">{product.topVariantRelevance?.bggRank ?? '—'}</TableCell>
      <TableCell className="hidden xl:table-cell text-right font-semibold">
        {(product.topVariantRelevance?.relevanceScore ?? 0).toFixed(4)}
      </TableCell>
      <TableCell className="hidden md:table-cell">{totalStock}</TableCell>
      <TableCell className="hidden md:table-cell">
        {product.createdAt.toLocaleDateString("en-US")}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
        {product.createdByAdminUser
          ? (product.createdByAdminUser.firstName && product.createdByAdminUser.lastName
            ? `${product.createdByAdminUser.firstName} ${product.createdByAdminUser.lastName}`
            : product.createdByAdminUser.username ?? '—')
          : '—'}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
        {product.updatedByAdminUser
          ? (product.updatedByAdminUser.firstName && product.updatedByAdminUser.lastName
            ? `${product.updatedByAdminUser.firstName} ${product.updatedByAdminUser.lastName}`
            : product.updatedByAdminUser.username ?? '—')
          : '—'}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
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
  );
}
