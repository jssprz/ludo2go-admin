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
  mediaLinks: { media: { url: string } }[];
  variants: any[];
}

export function ProductRow({ product }: { product: SelectProduct }) {
  const router = useRouter();
  const totalStock = product.variants.reduce(
    (sum: number, v: any) => sum + (v.stock ?? 0),
    0
  );

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/products/${product.id}/edit`)}
    >
      <TableCell className="hidden sm:table-cell">
        {product.mediaLinks.length > 0 ? (
          <Image
            alt="Product image"
            className="aspect-square rounded-md object-cover"
            height="64"
            src={product.mediaLinks[0].media.url}
            width="64"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
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
      <TableCell className="hidden md:table-cell">0</TableCell>
      <TableCell className="hidden md:table-cell">{totalStock}</TableCell>
      <TableCell className="hidden md:table-cell">
        {product.createdAt.toLocaleDateString("en-US")}
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
