'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, CalendarPlus, Loader2, Check } from 'lucide-react';

interface VariantResult {
  id: string;
  sku: string;
  edition: string | null;
  language: string;
  status: string;
  displayTitleShort: string | null;
  activeAtScheduled: string | null;
  product: {
    id: string;
    name: string;
  };
}

export function SetPresaleForm() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<VariantResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantResult | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState('');

  const searchVariants = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSuccessMessage('');
    try {
      const res = await fetch(
        `/api/variants/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  function selectVariant(v: VariantResult) {
    setSelectedVariant(v);
    setScheduleDate(
      v.activeAtScheduled ? v.activeAtScheduled.split('T')[0] : ''
    );
  }

  async function setAsPresale() {
    if (!selectedVariant || !scheduleDate) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/variants/${selectedVariant.id}/schedule`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'scheduled',
            activeAtScheduled: scheduleDate,
          }),
        });

        if (res.ok) {
          setSuccessMessage(
            `"${selectedVariant.sku}" has been set as pre-sale for ${new Date(scheduleDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
          );
          setSelectedVariant(null);
          setScheduleDate('');
          setResults([]);
          setSearchQuery('');
          router.refresh();
        }
      } catch (err) {
        console.error('Failed to set presale', err);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5" />
          Set Variant as Pre-Sale
        </CardTitle>
        <CardDescription>
          Search for a variant by SKU, product name, or edition, then set a
          scheduled release date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-[0.55rem] h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchVariants()}
              placeholder="Search by SKU, product name, or edition…"
              className="pl-8"
            />
          </div>
          <Button onClick={searchVariants} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2">
            <Check className="h-4 w-4" />
            {successMessage}
          </div>
        )}

        {/* Search results */}
        {results.length > 0 && !selectedVariant && (
          <div className="border rounded-md max-h-[300px] overflow-y-auto">
            {results.map((v) => (
              <button
                key={v.id}
                onClick={() => selectVariant(v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 text-left transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">{v.product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    SKU: <span className="font-mono">{v.sku}</span>
                    {v.edition && <> · Edition: {v.edition}</>}
                    {v.displayTitleShort && <> · {v.displayTitleShort}</>}
                    {' · '}
                    <span className="uppercase">{v.language}</span>
                  </div>
                </div>
                <Badge
                  variant={v.status === 'scheduled' ? 'default' : 'outline'}
                  className="capitalize text-xs shrink-0"
                >
                  {v.status}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {results.length === 0 && !isSearching && searchQuery && !selectedVariant && !successMessage && (
          <p className="text-sm text-muted-foreground">No variants found.</p>
        )}

        {/* Selected variant + date picker */}
        {selectedVariant && (
          <div className="border rounded-md p-4 space-y-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{selectedVariant.product.name}</div>
                <div className="text-sm text-muted-foreground">
                  SKU: <span className="font-mono">{selectedVariant.sku}</span>
                  {selectedVariant.edition && <> · Edition: {selectedVariant.edition}</>}
                  {selectedVariant.displayTitleShort && <> · {selectedVariant.displayTitleShort}</>}
                </div>
                <Badge
                  variant={selectedVariant.status === 'scheduled' ? 'default' : 'outline'}
                  className="capitalize text-xs mt-1"
                >
                  Current: {selectedVariant.status}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedVariant(null);
                  setScheduleDate('');
                }}
              >
                Change
              </Button>
            </div>

            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-date">Scheduled Release Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <Button
                onClick={setAsPresale}
                disabled={!scheduleDate || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CalendarPlus className="h-4 w-4 mr-2" />
                )}
                {selectedVariant.status === 'scheduled'
                  ? 'Update Schedule'
                  : 'Set as Pre-Sale'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
