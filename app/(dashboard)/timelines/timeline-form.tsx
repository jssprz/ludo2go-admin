'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { GameTimeline, GameTimelineEvent, ProductVariant, Product, GameTimelineEventType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

type TimelineWithEvents = GameTimeline & {
  events: (GameTimelineEvent & {
    linkedVariant?: (ProductVariant & { product: Product }) | null;
  })[];
};

type EventFormData = {
  id?: string;
  eventType: GameTimelineEventType | null;
  month: number | null;
  year: number;
  title: string;
  description: string;
  image: string;
  refLink: string;
  linkedVariantId: string | null;
};

type Props = {
  timeline?: TimelineWithEvents;
  variants?: (ProductVariant & { product: Product })[];
};

const EVENT_TYPES: GameTimelineEventType[] = [
  'prize',
  'release',
  'expansion',
  'edition',
  'variant',
  'reprint'
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function TimelineForm({ timeline, variants = [] }: Props) {
  const router = useRouter();
  const isEditing = !!timeline;

  // Initialize events from existing timeline or start with one empty event
  const [events, setEvents] = useState<EventFormData[]>(
    timeline?.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      month: e.month,
      year: e.year,
      title: e.title,
      description: e.description,
      image: e.image || '',
      refLink: e.refLink || '',
      linkedVariantId: e.linkedVariantId,
    })) || [
      {
        eventType: null,
        month: null,
        year: new Date().getFullYear(),
        title: '',
        description: '',
        image: '',
        refLink: '',
        linkedVariantId: null,
      },
    ]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function addEvent() {
    setEvents([
      ...events,
      {
        eventType: null,
        month: null,
        year: new Date().getFullYear(),
        title: '',
        description: '',
        image: '',
        refLink: '',
        linkedVariantId: null,
      },
    ]);
  }

  function removeEvent(index: number) {
    setEvents(events.filter((_, i) => i !== index));
  }

  function updateEvent(index: number, field: keyof EventFormData, value: any) {
    const updated = [...events];
    updated[index] = { ...updated[index], [field]: value };
    setEvents(updated);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    // Validate at least one event
    if (events.length === 0) {
      setErrorMsg('Timeline must have at least one event');
      setIsSaving(false);
      return;
    }

    // Validate required fields
    for (const event of events) {
      if (!event.year || !event.title || !event.description) {
        setErrorMsg('All events must have year, title, and description');
        setIsSaving(false);
        return;
      }
    }

    try {
      const url = isEditing ? `/api/timelines/${timeline.id}` : '/api/timelines';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to save timeline');
      }

      router.push('/timelines');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Timeline Events</h2>
          <Button type="button" variant="outline" size="sm" onClick={addEvent}>
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>

        {events.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No events yet. Click "Add Event" to create one.
          </p>
        )}

        {events.map((event, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Event {index + 1}
                  {event.title && `: ${event.title}`}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEvent(index)}
                  disabled={events.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Select
                    value={event.eventType || 'none'}
                    onValueChange={(val) =>
                      updateEvent(index, 'eventType', val === 'none' ? null : val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Month (Optional)</Label>
                  <Select
                    value={event.month?.toString() || 'none'}
                    onValueChange={(val) =>
                      updateEvent(index, 'month', val === 'none' ? null : parseInt(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Year *</Label>
                  <Input
                    type="number"
                    value={event.year}
                    onChange={(e) =>
                      updateEvent(index, 'year', parseInt(e.target.value) || 2000)
                    }
                    required
                    min="1900"
                    max="2100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={event.title}
                  onChange={(e) => updateEvent(index, 'title', e.target.value)}
                  placeholder="e.g., Initial Release, Kennerspiel des Jahres Winner"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={event.description}
                  onChange={(e) => updateEvent(index, 'description', e.target.value)}
                  placeholder="Describe this event in the game's history"
                  rows={3}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={event.image}
                    onChange={(e) => updateEvent(index, 'image', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reference Link</Label>
                  <Input
                    value={event.refLink}
                    onChange={(e) => updateEvent(index, 'refLink', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Linked Product Variant (Optional)</Label>
                <Select
                  value={event.linkedVariantId || 'none'}
                  onValueChange={(val) =>
                    updateEvent(index, 'linkedVariantId', val === 'none' ? null : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {variants.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No variants available
                      </SelectItem>
                    ) : (
                      variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.product.name} - {variant.sku}
                          {variant.edition && ` (${variant.edition})`}
                          {variant.language && ` [${variant.language}]`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this event to a specific product variant (e.g., for releases or editions)
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : isEditing ? 'Update Timeline' : 'Create Timeline'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
