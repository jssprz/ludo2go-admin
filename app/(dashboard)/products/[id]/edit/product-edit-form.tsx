'use client';

import { useState, FormEvent } from 'react';
import type {
  Product,
  GameDetails,
  AccessoryDetails,
  BundleDetails,
  BGGDetails,
} from '@prisma/client';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type ProductWithDetails = Product & {
  game: GameDetails | null;
  accessory: AccessoryDetails | null;
  bundle: BundleDetails | null;
  bgg: BGGDetails | null;
};

// Si quieres, puedes mover esto a un archivo de tipos compartidos
type ProductStatus = 'draft' | 'active' | 'archived';
type ProductKind = Product['kind'];

type Props = {
  product: ProductWithDetails;
};

export function ProductEditForm({ product }: Props) {
  const router = useRouter();

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [brand, setBrand] = useState(product.brand ?? '');
  const [kind, setKind] = useState<ProductKind>(product.kind);
  const [status, setStatus] = useState<ProductStatus>(
    product.status as ProductStatus
  );
  const [tags, setTags] = useState((product.tags ?? []).join(', '));
  const [shortDescription, setShortDescription] = useState(
    product.shortDescription ?? ''
  );
  const [description, setDescription] = useState(
    product.description ?? ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // transformar tags "tag1, tag2" -> ["tag1","tag2"]
    const normalizedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          slug,
          brand: brand || null,
          kind,
          status,
          tags: normalizedTags,
          shortDescription: shortDescription || null,
          description: description || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update product');
      }

      setSuccessMsg('Product updated successfully.');
      
      // refresh data and return to the list
      router.refresh();
      router.push('/products');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Devir, CMON"
          />
        </div>

        <div className="space-y-2">
          <Label>Kind</Label>
          <Select
            value={kind}
            onValueChange={(val) => setKind(val as ProductKind)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select kind" />
            </SelectTrigger>
            <SelectContent>
              {/* Ajusta según el enum ProductKind que tengas */}
              <SelectItem value="game">Game</SelectItem>
              <SelectItem value="accessory">Accessory</SelectItem>
              <SelectItem value="bundle">Bundle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as ProductStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="euro, family, party"
          />
          <p className="text-xs text-muted-foreground">
            Comma separated. Example: <code>euro, family, 2 players</code>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortDescription">Short description</Label>
        <Textarea
          id="shortDescription"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-sm text-emerald-600">{successMsg}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}