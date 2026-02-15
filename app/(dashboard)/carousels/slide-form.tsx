'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

type CarouselSlide = {
  id: string;
  carouselId: string;
  position: number;
  isActive: boolean;
  name: string | null;
  startAt: Date | null;
  endAt: Date | null;
};

type Props = {
  carouselId: string;
  slide?: CarouselSlide;
};

export function SlideForm({ carouselId, slide }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: slide?.name || '',
    isActive: slide?.isActive ?? true,
    startAt: slide?.startAt ? new Date(slide.startAt).toISOString().slice(0, 16) : '',
    endAt: slide?.endAt ? new Date(slide.endAt).toISOString().slice(0, 16) : '',
  });

  const isEditing = !!slide;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
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
        name: formData.name || null,
        startAt: formData.startAt ? new Date(formData.startAt).toISOString() : null,
        endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
      };

      const url = isEditing
        ? `/api/carousels/slides/${slide.id}`
        : `/api/carousels/${carouselId}/slides`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to save slide');
      }

      router.push(`/carousels/${carouselId}`);
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
          <Link href={`/carousels/${carouselId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Slide' : 'New Slide'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update slide configuration'
              : 'Create a new slide for the carousel'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Slide Settings</CardTitle>
            <CardDescription>
              Configure when and how this slide appears
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Summer Sale 2026"
              />
              <p className="text-xs text-muted-foreground">
                Internal name for analytics and organization
              </p>
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
              Set when this slide should be active. Leave empty for always-on.
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

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-sm mb-2">Next Step: Add Variants</h3>
          <p className="text-sm text-muted-foreground">
            After creating the slide, you'll be able to add variants with content, images, and CTAs.
            Variants allow you to A/B test different versions of the same slide.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href={`/carousels/${carouselId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEditing ? 'Update Slide' : 'Create Slide'}
          </Button>
        </div>
      </form>
    </div>
  );
}
