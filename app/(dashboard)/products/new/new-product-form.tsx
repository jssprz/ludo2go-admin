'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Usa los mismos tipos que en tu schema
type ProductStatus = 'draft' | 'active' | 'archived';
type ProductKind = 'game' | 'accessory' | 'bundle';

type BGGGameData = {
  id: number;
  name: string;
  description?: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playingTime?: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  mechanics?: string[];
  avgRating?: number;
  bayesAverageRating?: number;
  averageWeightRating?: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewProductForm() {
  const router = useRouter();

  // Core product
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [brand, setBrand] = useState('');
  const [kind, setKind] = useState<ProductKind>('game');
  const [status, setStatus] = useState<ProductStatus>('draft');
  const [tags, setTags] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Game-related
  const [yearPublished, setYearPublished] = useState<number | ''>('');
  const [minPlayers, setMinPlayers] = useState<number | ''>('');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>('');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [playtimeMin, setPlaytimeMin] = useState<number | ''>('');
  const [playtimeMax, setPlaytimeMax] = useState<number | ''>('');
  const [mechanics, setMechanics] = useState('');

  // BGG details
  const [bggId, setBggId] = useState('');
  const [avgRating, setAvgRating] = useState<number | ''>('');
  const [bayesAverageRating, setBayesAverageRating] = useState<number | ''>('');
  const [averageWeightRating, setAverageWeightRating] = useState<number | ''>('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingBGG, setIsFetchingBGG] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

   async function handleFetchFromBGG() {
    if (!bggId.trim()) return;

    setIsFetchingBGG(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/bgg/${bggId.trim()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to fetch from BGG');
      }

      const data: BGGGameData = await res.json();

      // Prefill campos del producto
      if (data.name) {
        setName(data.name);
        if (!slug) setSlug(slugify(data.name));
      }

      if (data.description) {
        setDescription(data.description);
        if (!shortDescription) {
          const clean = data.description.replace(/\s+/g, ' ');
          setShortDescription(clean.slice(0, 180) + (clean.length > 180 ? '…' : ''));
        }
      }

      if (data.yearPublished) setYearPublished(data.yearPublished);
      if (data.minPlayers) setMinPlayers(data.minPlayers);
      if (data.maxPlayers) setMaxPlayers(data.maxPlayers);
      if (data.minAge) setMinAge(data.minAge);

      if (data.minPlayTime) setPlaytimeMin(data.minPlayTime);
      if (data.maxPlayTime) setPlaytimeMax(data.maxPlayTime);
      else if (data.playingTime) {
        setPlaytimeMin(data.playingTime);
        setPlaytimeMax(data.playingTime);
      }

      if (data.mechanics && data.mechanics.length) {
        const mechStr = data.mechanics.join(', ');
        setMechanics(mechStr);
        if (!tags) setTags(mechStr);
      }

      if (typeof data.avgRating === 'number') setAvgRating(data.avgRating);
      if (typeof data.bayesAverageRating === 'number')
        setBayesAverageRating(data.bayesAverageRating);
      if (typeof data.averageWeightRating === 'number')
        setAverageWeightRating(data.averageWeightRating);

      setSuccessMsg('Fields populated from BGG.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error calling BGG API');
    } finally {
      setIsFetchingBGG(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const normalizedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const normalizedMechanics = mechanics
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name,
            slug: slug || slugify(name),
            brand: brand || null,
            kind,
            status,
            tags: normalizedTags,
            shortDescription: shortDescription || null,
            description: description || null,
          },
          game: kind === 'game'
            ? {
                yearPublished: yearPublished || null,
                minPlayers: minPlayers || null,
                maxPlayers: maxPlayers || null,
                minAge: minAge || null,
                playtimeMin: playtimeMin || null,
                playtimeMax: playtimeMax || null,
                mechanics: normalizedMechanics,
              }
            : null,
          bgg:
            bggId.trim() !== ''
              ? {
                  bggId: Number(bggId),
                  avgRating: avgRating || null,
                  bayesAverageRating: bayesAverageRating || null,
                  averageWeightRating: averageWeightRating || null,
                }
              : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to create product');
      }

      const created = await res.json();
      setSuccessMsg('Product created successfully.');
      router.push(`/products/${created.id}/edit`);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* BGG ID block */}
      <div className="space-y-2 border rounded-md p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="bggId">BGG ID (optional)</Label>
            <Input
              id="bggId"
              value={bggId}
              onChange={(e) => setBggId(e.target.value)}
              placeholder="e.g. 174430 (Gloomhaven)"
            />
            <p className="text-xs text-muted-foreground">
              Enter a BoardGameGeek ID and click &quot;Fetch from BGG&quot; to prefill fields.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFetchFromBGG}
            // disabled={!bggId.trim() || isFetchingBGG}
            disabled={true}
          >
            {isFetchingBGG ? 'Fetching...' : 'Fetch from BGG (Coming soon)'}
          </Button>
        </div>
      </div>

      {/* Core product fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name*</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug*</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated if left empty"
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
            placeholder="euro, family, cooperative"
          />
          <p className="text-xs text-muted-foreground">
            Comma separated. Example: <code>euro, family, 2 players</code>
          </p>
        </div>
      </div>

      {/* Descriptions */}
      <div className="space-y-2">
        <Label htmlFor="shortDescription">Short description</Label>
        <textarea
          id="shortDescription"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Game & BGG extra fields (solo sentido si kind=game, pero los mostramos simple por ahora) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="yearPublished">Year published</Label>
          <Input
            id="yearPublished"
            type="number"
            value={yearPublished}
            onChange={(e) =>
              setYearPublished(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minPlayers">Min players</Label>
          <Input
            id="minPlayers"
            type="number"
            value={minPlayers}
            onChange={(e) =>
              setMinPlayers(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxPlayers">Max players</Label>
          <Input
            id="maxPlayers"
            type="number"
            value={maxPlayers}
            onChange={(e) =>
              setMaxPlayers(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minAge">Min age</Label>
          <Input
            id="minAge"
            type="number"
            value={minAge}
            onChange={(e) =>
              setMinAge(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="playtimeMin">Playtime min (min)</Label>
          <Input
            id="playtimeMin"
            type="number"
            value={playtimeMin}
            onChange={(e) =>
              setPlaytimeMin(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="playtimeMax">Playtime max (min)</Label>
          <Input
            id="playtimeMax"
            type="number"
            value={playtimeMax}
            onChange={(e) =>
              setPlaytimeMax(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>

        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="mechanics">Mechanics</Label>
          <Input
            id="mechanics"
            value={mechanics}
            onChange={(e) => setMechanics(e.target.value)}
            placeholder="Deck Building, Worker Placement"
          />
        </div>
      </div>

      {/* Some BGG metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="avgRating">BGG Avg rating</Label>
          <Input
            id="avgRating"
            type="number"
            step="0.01"
            value={avgRating}
            onChange={(e) =>
              setAvgRating(e.target.value ? Number(e.target.value) : '')
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bayesAverageRating">BGG Bayes avg rating</Label>
          <Input
            id="bayesAverageRating"
            type="number"
            step="0.01"
            value={bayesAverageRating}
            onChange={(e) =>
              setBayesAverageRating(
                e.target.value ? Number(e.target.value) : ''
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="averageWeightRating">BGG Weight</Label>
          <Input
            id="averageWeightRating"
            type="number"
            step="0.01"
            value={averageWeightRating}
            onChange={(e) =>
              setAverageWeightRating(
                e.target.value ? Number(e.target.value) : ''
              )
            }
          />
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      {successMsg && (
        <p className="text-sm text-emerald-600">{successMsg}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Create product'}
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