'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Save,
  Loader2,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface RecommendationProfile {
  productId: string;
  idealForCouples: boolean | null;
  idealForFamilies: boolean | null;
  idealForParties: boolean | null;
  idealForNewPlayers: boolean | null;
  giftable: boolean | null;
  vibeTags: string[];
  avoidTags: string[];
  interactionLevel: string | null;
  conflictLevel: string | null;
  luckLevel: string | null;
  explanationEase: string | null;
  playerFit2: number | null;
  playerFit3: number | null;
  playerFit4: number | null;
  playerFit5: number | null;
  playerFit6Plus: number | null;
  oneLinePitch: string | null;
  bestForText: string | null;
  cautionText: string | null;
  stockPriority: number | null;
  featuredPriority: number | null;
}

interface ProductWithProfile {
  id: string;
  name: string;
  kind: string;
  status: string;
  recommendationProfile: RecommendationProfile | null;
}

const LEVEL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const EXPLANATION_EASE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'very_easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'very_hard', label: 'Very Hard' },
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'with_profile', label: 'Has Profile' },
  { value: 'without_profile', label: 'No Profile' },
];

function emptyProfile(productId: string): RecommendationProfile {
  return {
    productId,
    idealForCouples: false,
    idealForFamilies: false,
    idealForParties: false,
    idealForNewPlayers: false,
    giftable: false,
    vibeTags: [],
    avoidTags: [],
    interactionLevel: null,
    conflictLevel: null,
    luckLevel: null,
    explanationEase: null,
    playerFit2: 0,
    playerFit3: 0,
    playerFit4: 0,
    playerFit5: 0,
    playerFit6Plus: 0,
    oneLinePitch: null,
    bestForText: null,
    cautionText: null,
    stockPriority: 0,
    featuredPriority: 0,
  };
}

// ─── Inline editable row ─────────────────────────────────────────

function ProfileRow({
  product,
  onSaved,
}: {
  product: ProductWithProfile;
  onSaved: () => void;
}) {
  const initial = product.recommendationProfile ?? emptyProfile(product.id);
  const [profile, setProfile] = useState<RecommendationProfile>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Detect if there are unsaved changes
  const isDirty = JSON.stringify(profile) !== JSON.stringify(initial);

  function set<K extends keyof RecommendationProfile>(
    key: K,
    value: RecommendationProfile[K]
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setIsSaving(true);
    try {
      const { productId: _pid, ...rest } = profile;
      const res = await fetch('/api/recommendation-profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, ...rest }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  }

  const hasProfile = product.recommendationProfile !== null;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="font-medium text-sm max-w-[250px]">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{product.name}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="capitalize text-[10px]">
            {product.kind}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="capitalize text-[10px]">
            {product.status}
          </Badge>
        </TableCell>
        <TableCell>
          {hasProfile ? (
            <Badge className="bg-green-100 text-green-700 text-[10px]">
              ✓ Set
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              Empty
            </Badge>
          )}
        </TableCell>
        {/* Quick boolean overview */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={profile.idealForFamilies ?? false}
            onCheckedChange={(v: boolean | 'indeterminate') => set('idealForFamilies', !!v)}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={profile.idealForCouples ?? false}
            onCheckedChange={(v: boolean | 'indeterminate') => set('idealForCouples', !!v)}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={profile.idealForParties ?? false}
            onCheckedChange={(v: boolean | 'indeterminate') => set('idealForParties', !!v)}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={profile.idealForNewPlayers ?? false}
            onCheckedChange={(v: boolean | 'indeterminate') => set('idealForNewPlayers', !!v)}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={profile.giftable ?? false}
            onCheckedChange={(v: boolean | 'indeterminate') => set('giftable', !!v)}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {isDirty && (
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={save}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : saved ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
              </Button>
            )}
            {saved && !isDirty && (
              <span className="text-green-600 text-xs flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {expanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={10} onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-3 px-2">
              {/* Levels */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Levels
                </h4>
                <LevelSelect
                  label="Interaction"
                  value={profile.interactionLevel}
                  options={LEVEL_OPTIONS}
                  onChange={(v) => set('interactionLevel', v || null)}
                />
                <LevelSelect
                  label="Conflict"
                  value={profile.conflictLevel}
                  options={LEVEL_OPTIONS}
                  onChange={(v) => set('conflictLevel', v || null)}
                />
                <LevelSelect
                  label="Luck"
                  value={profile.luckLevel}
                  options={LEVEL_OPTIONS}
                  onChange={(v) => set('luckLevel', v || null)}
                />
                <LevelSelect
                  label="Explanation Ease"
                  value={profile.explanationEase}
                  options={EXPLANATION_EASE_OPTIONS}
                  onChange={(v) => set('explanationEase', v || null)}
                />
              </div>

              {/* Player Fit (0–5 score) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Player Fit (0–5)
                </h4>
                <NumberField label="2 players" value={profile.playerFit2} onChange={(v) => set('playerFit2', v)} />
                <NumberField label="3 players" value={profile.playerFit3} onChange={(v) => set('playerFit3', v)} />
                <NumberField label="4 players" value={profile.playerFit4} onChange={(v) => set('playerFit4', v)} />
                <NumberField label="5 players" value={profile.playerFit5} onChange={(v) => set('playerFit5', v)} />
                <NumberField label="6+ players" value={profile.playerFit6Plus} onChange={(v) => set('playerFit6Plus', v)} />
              </div>

              {/* Priority & Tags */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Priority & Tags
                </h4>
                <NumberField label="Stock Priority" value={profile.stockPriority} onChange={(v) => set('stockPriority', v)} />
                <NumberField label="Featured Priority" value={profile.featuredPriority} onChange={(v) => set('featuredPriority', v)} />
                <TagsField
                  label="Vibe Tags"
                  value={profile.vibeTags}
                  onChange={(v) => set('vibeTags', v)}
                />
                <TagsField
                  label="Avoid Tags"
                  value={profile.avoidTags}
                  onChange={(v) => set('avoidTags', v)}
                />
              </div>

              {/* Text fields */}
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Descriptions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TextField
                    label="One-line Pitch"
                    value={profile.oneLinePitch}
                    onChange={(v) => set('oneLinePitch', v || null)}
                  />
                  <TextField
                    label="Best For"
                    value={profile.bestForText}
                    onChange={(v) => set('bestForText', v || null)}
                  />
                  <TextField
                    label="Caution"
                    value={profile.cautionText}
                    onChange={(v) => set('cautionText', v || null)}
                  />
                </div>
              </div>

              {/* Save button */}
              <div className="md:col-span-2 lg:col-span-3 flex justify-end pt-2">
                <Button
                  onClick={save}
                  disabled={isSaving || !isDirty}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isDirty ? 'Save Changes' : 'No Changes'}
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Field components ────────────────────────────────────────────

function LevelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-28 shrink-0">{label}</span>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-28 shrink-0">{label}</span>
      <Input
        type="number"
        min={0}
        max={10}
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-7 w-20 text-xs"
      />
    </div>
  );
}

function TagsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState(value.join(', '));

  function handleBlur() {
    const tags = text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onChange(tags);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-28 shrink-0">{label}</span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="tag1, tag2, tag3"
        className="h-7 text-xs"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────

export default function RecommendationProfilesPage() {
  const [products, setProducts] = useState<ProductWithProfile[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [profileFilter, setProfileFilter] = useState('all');

  const fetchData = useCallback(async (q = '') => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/recommendation-profiles?q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (err) {
      console.error('Fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchData(search);
  }

  const filtered = products.filter((p) => {
    if (profileFilter === 'with_profile') return p.recommendationProfile !== null;
    if (profileFilter === 'without_profile') return p.recommendationProfile === null;
    return true;
  });

  const withProfileCount = products.filter(
    (p) => p.recommendationProfile !== null
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          Recommendation Profiles
        </h1>
        <p className="text-muted-foreground">
          Set recommendation metadata for all games and expansions. Click a row to
          expand and edit all fields.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Total Games</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-green-600">
              {withProfileCount}
            </div>
            <p className="text-xs text-muted-foreground">With Profile</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-orange-500">
              {products.length - withProfileCount}
            </div>
            <p className="text-xs text-muted-foreground">Missing Profile</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>All Games & Expansions</CardTitle>
              <CardDescription>
                {filtered.length} products shown
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter by profile status */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={profileFilter}
                  onValueChange={setProfileFilter}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-[0.45rem] h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="search"
                  placeholder="Search games…"
                  className="h-8 w-[200px] pl-8 text-sm"
                />
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-16">Kind</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead className="w-16">Profile</TableHead>
                    <TableHead className="w-10 text-center text-[10px]">Families</TableHead>
                    <TableHead className="w-10 text-center text-[10px]">Couples</TableHead>
                    <TableHead className="w-10 text-center text-[10px]">Parties</TableHead>
                    <TableHead className="w-10 text-center text-[10px]">New Players</TableHead>
                    <TableHead className="w-10 text-center text-[10px]">Giftable</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No products found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <ProfileRow
                        key={p.id}
                        product={p}
                        onSaved={() => fetchData(search)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
