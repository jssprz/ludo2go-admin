'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

type Carousel = {
  id: string;
  key: string;
  placement: string;
  title: string | null;
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
};

type Props = {
  carousel?: Carousel;
};

const PLACEMENTS = [
  { value: 'HOME_MAIN', label: 'Home Main' },
  { value: 'HOME_SECONDARY', label: 'Home Secondary' },
  { value: 'OTHER', label: 'Other' },
];

export function CarouselForm({ carousel }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    key: carousel?.key || '',
    placement: carousel?.placement || 'HOME_MAIN',
    title: carousel?.title || '',
    isActive: carousel?.isActive ?? true,
    startAt: carousel?.startAt ? new Date(carousel.startAt).toISOString().slice(0, 16) : '',
    endAt: carousel?.endAt ? new Date(carousel.endAt).toISOString().slice(0, 16) : '',
  });

  const isEditing = !!carousel;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        title: formData.title || null,
        startAt: formData.startAt ? new Date(formData.startAt).toISOString() : null,
        endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
      };

      const url = isEditing
        ? `/api/carousels/${carousel.id}`
        : '/api/carousels';
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to save carousel');
      }

      const result = await res.json();
      router.push(`/carousels/${result.id}`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/carousels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Carousel' : 'New Carousel'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update carousel configuration'
              : 'Create a new carousel for your storefront'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Carousel Details</CardTitle>
            <CardDescription>
              Basic information about the carousel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">
                  Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="key"
                  name="key"
                  value={formData.key}
                  onChange={handleChange}
                  placeholder="e.g., home-main"
                  required
                  disabled={isEditing}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this carousel {isEditing && '(cannot be changed)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="placement">
                  Placement <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.placement}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, placement: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Where the carousel appears on the site
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Optional display title"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active (visible to users)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling (Optional)</CardTitle>
            <CardDescription>
              Set when this carousel should be active. Leave empty for always-on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start Date & Time</Label>
                <Input
                  id="startAt"
                  name="startAt"
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endAt">End Date & Time</Label>
                <Input
                  id="endAt"
                  name="endAt"
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/carousels">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEditing ? 'Update Carousel' : 'Create Carousel'}
          </Button>
        </div>
      </form>
    </div>
  );
}
