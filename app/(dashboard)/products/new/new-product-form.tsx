'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Usa los mismos tipos que en tu schema
type ProductStatus = 'draft' | 'active' | 'archived';
type ProductKind = 'game' | 'expansion' | 'accessory' | 'bundle';

type BGGRankData = {
  type: string;
  id: number;
  name: string;
  friendlyName: string;
  value: number | 'Not Ranked';
  bayesAverage?: number;
};

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
  matchedMechanics?: Array<{ id: string; name: string; slug: string; bggId: number | null }>;
  unmatchedMechanics?: Array<{ bggId: number; name: string }>;
  links?: Array<{ type: string; id: number; value: string; inbound?: boolean }>;
  avgRating?: number;
  bayesAverageRating?: number;
  averageWeightRating?: number;
  ranks?: BGGRankData[];
  boardgameRank?: number | null;
  image?: string;
  thumbnail?: string;
  categories?: string[];
  designers?: string[];
  publishers?: string[];
};

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type TimelineSummary = {
  id: string;
  events: Array<{
    year: number;
    title: string;
  }>;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type ComplexityOption = {
  id: string;
  name: string;
  slug: string;
}

type BaseGameOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  brands: BrandOption[];
  timelines: TimelineSummary[];
  gameCategories: CategoryOption[];
  accessoryCategories: CategoryOption[];
  gameThemes: CategoryOption[];
  gameMechanics: CategoryOption[];
  gameComplexities: ComplexityOption[];
  baseGames: BaseGameOption[];
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewProductForm({ brands, timelines, gameCategories, accessoryCategories, gameThemes, gameMechanics, gameComplexities, baseGames }: Props) {
  const router = useRouter();

  // Core product
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState('');
  const [kind, setKind] = useState<ProductKind>('game');
  const [status, setStatus] = useState<ProductStatus>('draft');
  const [tags, setTags] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Game-related
  const [timelineId, setTimelineId] = useState('');
  const [complexityTierId, setComplexityTierId] = useState('');
  const [yearPublished, setYearPublished] = useState<number | ''>('');
  const [minPlayers, setMinPlayers] = useState<number | ''>('');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>('');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [playtimeMin, setPlaytimeMin] = useState<number | ''>('');
  const [playtimeMax, setPlaytimeMax] = useState<number | ''>('');

  // Categories
  const [selectedGameCategoryIds, setSelectedGameCategoryIds] = useState<string[]>([]);
  const [selectedAccessoryCategoryIds, setSelectedAccessoryCategoryIds] = useState<string[]>([]);

  // Themes & Mechanics
  const [selectedGameThemeIds, setSelectedGameThemeIds] = useState<string[]>([]);
  const [selectedGameMechanicIds, setSelectedGameMechanicIds] = useState<string[]>([]);

  // BGG details
  const [bggId, setBggId] = useState('');
  const [avgRating, setAvgRating] = useState<number | ''>('');
  const [bayesAverageRating, setBayesAverageRating] = useState<number | ''>('');
  const [averageWeightRating, setAverageWeightRating] = useState<number | ''>('');
  const [boardgameRank, setBoardgameRank] = useState<number | ''>('');
  const [bggRanks, setBggRanks] = useState<BGGRankData[]>([]);

  // Expansion-specific fields
  const [baseGameId, setBaseGameId] = useState('');
  const [addedComponents, setAddedComponents] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMajor, setIsMajor] = useState(false);
  const [editionNumber, setEditionNumber] = useState<number | ''>('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingBGG, setIsFetchingBGG] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isGameProduct = kind === 'game';
  const isExpansionProduct = kind === 'expansion';
  const isGameOrExpansion = isGameProduct || isExpansionProduct;
  const isAccessoryProduct = kind === 'accessory';

  function addGameCategory(categoryId: string) {
    if (!selectedGameCategoryIds.includes(categoryId)) {
      setSelectedGameCategoryIds([...selectedGameCategoryIds, categoryId]);
    }
  }

  function removeGameCategory(categoryId: string) {
    setSelectedGameCategoryIds(selectedGameCategoryIds.filter(id => id !== categoryId));
  }

  function addAccessoryCategory(categoryId: string) {
    if (!selectedAccessoryCategoryIds.includes(categoryId)) {
      setSelectedAccessoryCategoryIds([...selectedAccessoryCategoryIds, categoryId]);
    }
  }

  function removeAccessoryCategory(categoryId: string) {
    setSelectedAccessoryCategoryIds(selectedAccessoryCategoryIds.filter(id => id !== categoryId));
  }

  function addGameTheme(themeId: string) {
    if (!selectedGameThemeIds.includes(themeId)) {
      setSelectedGameThemeIds([...selectedGameThemeIds, themeId]);
    }
  }

  function removeGameTheme(themeId: string) {
    setSelectedGameThemeIds(selectedGameThemeIds.filter(id => id !== themeId));
  }

  function addGameMechanic(mechanicId: string) {
    if (!selectedGameMechanicIds.includes(mechanicId)) {
      setSelectedGameMechanicIds([...selectedGameMechanicIds, mechanicId]);
    }
  }

  function removeGameMechanic(mechanicId: string) {
    setSelectedGameMechanicIds(selectedGameMechanicIds.filter(id => id !== mechanicId));
  }

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
        if (!tags) setTags(mechStr);
      }

      // Auto-select matched mechanics from our DB
      if (data.matchedMechanics && data.matchedMechanics.length > 0) {
        const matchedIds = data.matchedMechanics.map(m => m.id);
        setSelectedGameMechanicIds(prev => {
          const combined = new Set([...prev, ...matchedIds]);
          return Array.from(combined);
        });
      }

      // Log unmatched mechanics so the user knows
      if (data.unmatchedMechanics && data.unmatchedMechanics.length > 0) {
        console.warn('BGG mechanics not found in DB:', data.unmatchedMechanics);
      }

      if (typeof data.avgRating === 'number') setAvgRating(data.avgRating);
      if (typeof data.bayesAverageRating === 'number')
        setBayesAverageRating(data.bayesAverageRating);
      if (typeof data.averageWeightRating === 'number')
        setAverageWeightRating(data.averageWeightRating);
      if (typeof data.boardgameRank === 'number')
        setBoardgameRank(data.boardgameRank);
      if (data.ranks && data.ranks.length > 0)
        setBggRanks(data.ranks);

      let msg = 'Fields populated from BGG.';
      if (data.matchedMechanics?.length) {
        msg += ` ${data.matchedMechanics.length} mechanic(s) auto-selected.`;
      }
      if (data.unmatchedMechanics?.length) {
        msg += ` ${data.unmatchedMechanics.length} BGG mechanic(s) not in DB: ${data.unmatchedMechanics.map(m => m.name).join(', ')}.`;
      }
      setSuccessMsg(msg);
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

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name,
            slug: slug || slugify(name),
            brandId: brandId || null,
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
              timelineId: timelineId || null,
              complexityTierId: complexityTierId || null,
              gameCategoryIds: selectedGameCategoryIds,
              gameThemeIds: selectedGameThemeIds,
              gameMechanicIds: selectedGameMechanicIds,
            }
            : null,
          expansion: kind === 'expansion'
            ? {
              baseGameId: baseGameId || null,
              yearPublished: yearPublished || null,
              minPlayers: minPlayers || null,
              maxPlayers: maxPlayers || null,
              minAge: minAge || null,
              playtimeMin: playtimeMin || null,
              playtimeMax: playtimeMax || null,
              timelineId: timelineId || null,
              complexityTierId: complexityTierId || null,
              addedComponents: addedComponents || null,
              isStandalone,
              isMajor,
              editionNumber: editionNumber !== '' ? Number(editionNumber) : null,
              gameCategoryIds: selectedGameCategoryIds,
              gameThemeIds: selectedGameThemeIds,
              gameMechanicIds: selectedGameMechanicIds,
            }
            : null,
          accessory: kind === 'accessory'
            ? {
              accessoryCategoryIds: selectedAccessoryCategoryIds,
            }
            : null,
          bgg:
            bggId.trim() !== ''
              ? {
                bggId: Number(bggId),
                avgRating: avgRating || null,
                bayesAverageRating: bayesAverageRating || null,
                averageWeightRating: averageWeightRating || null,
                boardgameRank: boardgameRank || null,
                ranks: bggRanks.length > 0 ? bggRanks : null,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Left column: Product details ── */}
        <div className="space-y-6">
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
              <Label>Brand</Label>
              <Select
                value={brandId || 'none'}
                onValueChange={(val) => setBrandId(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
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
                  <SelectItem value="expansion">Expansion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isGameOrExpansion && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Game Categories */}
              <div className="space-y-3 border rounded-md p-4">
                <div>
                  <h2 className="text-sm font-medium">Game Categories</h2>
                  <p className="text-xs text-muted-foreground">
                    Assign categories to this game.{' '}
                    <Link href="/game-categories" className="text-blue-600 hover:underline">
                      Manage categories
                    </Link>
                  </p>
                </div>

                {selectedGameCategoryIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGameCategoryIds.map((catId) => {
                      const category = gameCategories.find(c => c.id === catId);
                      if (!category) return null;
                      return (
                        <Badge key={catId} variant="secondary" className="gap-1">
                          {category.name}
                          <button
                            type="button"
                            onClick={() => removeGameCategory(catId)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <Select
                  value=""
                  onValueChange={(val) => { if (val) addGameCategory(val); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add game category" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id} disabled={selectedGameCategoryIds.includes(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Game Themes */}
              <div className="space-y-3 border rounded-md p-4">
                <div>
                  <h2 className="text-sm font-medium">Game Themes</h2>
                  <p className="text-xs text-muted-foreground">
                    Assign themes to this game.{' '}
                    <Link href="/game-themes" className="text-blue-600 hover:underline">
                      Manage themes
                    </Link>
                  </p>
                </div>

                {selectedGameThemeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGameThemeIds.map((themeId) => {
                      const theme = gameThemes.find(t => t.id === themeId);
                      if (!theme) return null;
                      return (
                        <Badge key={themeId} variant="secondary" className="gap-1">
                          {theme.name}
                          <button
                            type="button"
                            onClick={() => removeGameTheme(themeId)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <Select
                  value=""
                  onValueChange={(val) => { if (val) addGameTheme(val); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add game theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameThemes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} disabled={selectedGameThemeIds.includes(theme.id)}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Game Mechanics */}
              <div className="space-y-3 border rounded-md p-4">
                <div>
                  <h2 className="text-sm font-medium">Game Mechanics</h2>
                  <p className="text-xs text-muted-foreground">
                    Assign mechanics to this game.{' '}
                    <Link href="/game-mechanics" className="text-blue-600 hover:underline">
                      Manage mechanics
                    </Link>
                  </p>
                </div>

                {selectedGameMechanicIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGameMechanicIds.map((mechanicId) => {
                      const mechanic = gameMechanics.find(m => m.id === mechanicId);
                      if (!mechanic) return null;
                      return (
                        <Badge key={mechanicId} variant="secondary" className="gap-1">
                          {mechanic.name}
                          <button
                            type="button"
                            onClick={() => removeGameMechanic(mechanicId)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <Select
                  value=""
                  onValueChange={(val) => { if (val) addGameMechanic(val); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add game mechanic" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameMechanics.map((mechanic) => (
                      <SelectItem key={mechanic.id} value={mechanic.id} disabled={selectedGameMechanicIds.includes(mechanic.id)}>
                        {mechanic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Game Complexity Tier */}
              <div className="space-y-3 border rounded-md p-4">
                <div>
                  <h2 className="text-sm font-medium">Game Complexity</h2>
                  <p className="text-xs text-muted-foreground">
                    Select the complexity of this game.{' '}
                    <Link href="/game-complexities" className="text-blue-600 hover:underline">
                      Manage complexity tiers
                    </Link>
                  </p>
                </div>
                <Select
                  value={complexityTierId || 'none'}
                  onValueChange={(val) => setComplexityTierId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select complexity tier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {gameComplexities.length === 0 ? (
                      <SelectItem value="empty" disabled>No complexity tiers available</SelectItem>
                    ) : (
                      gameComplexities.map((complexity) => (
                        <SelectItem key={complexity.id} value={complexity.id}>
                          {complexity.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Timeline for game products */}
              <div className="space-y-3 border rounded-md p-4">
                <div>
                  <h2 className="text-sm font-medium">Game Timeline</h2>
                  <p className="text-xs text-muted-foreground">
                    Link this game to a historical timeline.{' '}
                    <Link href="/timelines" className="text-blue-600 hover:underline">
                      Manage timelines
                    </Link>
                  </p>
                </div>
                <Select
                  value={timelineId || 'none'}
                  onValueChange={(val) => setTimelineId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeline (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {timelines.length === 0 ? (
                      <SelectItem value="empty" disabled>No timelines available</SelectItem>
                    ) : (
                      timelines.map((timeline) => (
                        <SelectItem key={timeline.id} value={timeline.id}>
                          Timeline: {timeline.events[0]?.year || 'N/A'} - {timeline.events[0]?.title || 'Untitled'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* GameDetails fields for game and expansion products */}
          {isGameOrExpansion && (
            <div className="grid gap-4 sm:grid-cols-3 border rounded-md p-4">
              <h2 className="text-sm font-medium sm:col-span-3">
                {isExpansionProduct ? 'Expansion Details' : 'Game Details'}
              </h2>
              <div className="space-y-2">
                <Label htmlFor="yearPublished">Year published</Label>
                <Input
                  id="yearPublished"
                  type="number"
                  value={yearPublished}
                  onChange={e => setYearPublished(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minPlayers">Min players</Label>
                <Input
                  id="minPlayers"
                  type="number"
                  value={minPlayers}
                  onChange={e => setMinPlayers(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPlayers">Max players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minAge">Min age</Label>
                <Input
                  id="minAge"
                  type="number"
                  value={minAge}
                  onChange={e => setMinAge(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playtimeMin">Playtime min (min)</Label>
                <Input
                  id="playtimeMin"
                  type="number"
                  value={playtimeMin}
                  onChange={e => setPlaytimeMin(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playtimeMax">Playtime max (min)</Label>
                <Input
                  id="playtimeMax"
                  type="number"
                  value={playtimeMax}
                  onChange={e => setPlaytimeMax(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
            </div>
          )}

          {/* Expansion-specific fields */}
          {isExpansionProduct && (
            <div className="grid gap-4 sm:grid-cols-2 border rounded-md p-4">
              <h2 className="text-sm font-medium sm:col-span-2">Expansion Info</h2>

              <div className="space-y-2 sm:col-span-2">
                <Label>Base Game *</Label>
                <Select
                  value={baseGameId || 'none'}
                  onValueChange={(val) => setBaseGameId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select base game" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a base game…</SelectItem>
                    {baseGames.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The base game this expansion extends. Must be an existing game product.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addedComponents">Added components</Label>
                <Textarea
                  id="addedComponents"
                  value={addedComponents}
                  onChange={(e) => setAddedComponents(e.target.value)}
                  rows={2}
                  placeholder="e.g. 30 new cards, 2 player boards, 10 meeples"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editionNumber">Edition number</Label>
                <Input
                  id="editionNumber"
                  type="number"
                  value={editionNumber}
                  onChange={e => setEditionNumber(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 1"
                />
              </div>

              <div className="flex flex-col gap-3 justify-end">
                <div className="flex items-center gap-2">
                  <input
                    id="isStandalone"
                    type="checkbox"
                    checked={isStandalone}
                    onChange={(e) => setIsStandalone(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isStandalone" className="text-sm font-normal">
                    Standalone (can be played without the base game)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isMajor"
                    type="checkbox"
                    checked={isMajor}
                    onChange={(e) => setIsMajor(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isMajor" className="text-sm font-normal">
                    Major expansion (significant content addition)
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Accessory Categories */}
          {isAccessoryProduct && (
            <div className="space-y-3 border rounded-md p-4">
              <div>
                <h2 className="text-sm font-medium">Accessory Categories</h2>
                <p className="text-xs text-muted-foreground">
                  Assign categories to this accessory.{' '}
                  <Link href="/accessory-categories" className="text-blue-600 hover:underline">
                    Manage categories
                  </Link>
                </p>
              </div>

              {selectedAccessoryCategoryIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedAccessoryCategoryIds.map((catId) => {
                    const category = accessoryCategories.find(c => c.id === catId);
                    if (!category) return null;
                    return (
                      <Badge key={catId} variant="secondary" className="gap-1">
                        {category.name}
                        <button
                          type="button"
                          onClick={() => removeAccessoryCategory(catId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <Select
                value=""
                onValueChange={(val) => { if (val) addAccessoryCategory(val); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add accessory category" />
                </SelectTrigger>
                <SelectContent>
                  {accessoryCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id} disabled={selectedAccessoryCategoryIds.includes(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Descriptions */}
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
            <RichTextEditor
              value={description}
              onValueChange={setDescription}
              placeholder="Product description…"
            />
          </div>


        </div>

        {/* ── Right column: BGG ── */}
        <div className="space-y-6">
          {/* BGG ID & Fetch */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="text-sm font-medium">BoardGameGeek</h2>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="bggId">BGG ID (optional)</Label>
                <Input
                  id="bggId"
                  value={bggId}
                  onChange={(e) => setBggId(e.target.value)}
                  placeholder="e.g. 174430"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchFromBGG}
              >
                {isFetchingBGG ? 'Fetching...' : 'Fetch'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a BGG ID and click to prefill fields.
            </p>
          </div>

          {/* BGG Metrics */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="text-sm font-medium">BGG Ratings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="avgRating">Avg rating</Label>
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
                <Label htmlFor="bayesAverageRating">Bayes avg</Label>
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
                <Label htmlFor="averageWeightRating">Weight</Label>
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
              <div className="space-y-2">
                <Label htmlFor="boardgameRank">Board Game Rank</Label>
                <Input
                  id="boardgameRank"
                  type="number"
                  step="1"
                  value={boardgameRank}
                  onChange={(e) =>
                    setBoardgameRank(e.target.value ? Number(e.target.value) : '')
                  }
                />
              </div>
            </div>
          </div>

          {/* BGG Ranks */}
          {bggRanks.length > 0 && (
            <div className="border rounded-md p-4 space-y-3">
              <h2 className="text-sm font-medium">BGG Ranks</h2>
              <div className="divide-y text-sm">
                {bggRanks.map((rank) => (
                  <div key={rank.id} className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">{rank.friendlyName}</span>
                    <span className="font-medium">
                      {rank.value === 'Not Ranked' ? 'Not Ranked' : `#${rank.value}`}
                      {rank.bayesAverage != null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (bayes: {rank.bayesAverage.toFixed(2)})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: messages + actions */}
      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      {successMsg && (
        <p className="text-sm text-emerald-600">{successMsg}</p>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}