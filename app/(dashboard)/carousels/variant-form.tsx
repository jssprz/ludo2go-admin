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

type CarouselSlideVariant = {
  id: string;
  slideId: string;
  name: string | null;
  isActive: boolean;
  weight: number;
  payload: any;
  ctaText: string | null;
  ctaUrl: string | null;
  ctaType: string | null;
  ctaTarget: string | null;
  startAt: Date | null;
  endAt: Date | null;
};

type Props = {
  carouselId: string;
  slideId: string;
  variant?: CarouselSlideVariant;
};

const CTA_TYPES = [
  { value: 'INTERNAL', label: 'Internal Link' },
  { value: 'EXTERNAL', label: 'External Link' },
];

const LINK_TARGETS = [
  { value: 'SAME_TAB', label: 'Same Tab' },
  { value: 'NEW_TAB', label: 'New Tab' },
];

export function VariantForm({ carouselId, slideId, variant }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: variant?.name || '',
    isActive: variant?.isActive ?? true,
    weight: variant?.weight || 1,
    payloadJson: JSON.stringify(variant?.payload || {
      headline: '',
      subheadline: '',
      badge: '',
      image: { desktop: '', mobile: '' },
      theme: { style: 'dark', accent: '#000000' }
    }, null, 2),
    ctaText: variant?.ctaText || '',
    ctaUrl: variant?.ctaUrl || '',
    ctaType: variant?.ctaType || 'INTERNAL',
    ctaTarget: variant?.ctaTarget || 'SAME_TAB',
    startAt: variant?.startAt ? new Date(variant.startAt).toISOString().slice(0, 16) : '',
    endAt: variant?.endAt ? new Date(variant.endAt).toISOString().slice(0, 16) : '',
  });

  const [jsonError, setJsonError] = useState<string>('');

  const isEditing = !!variant;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    
    if (name === 'payloadJson') {
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Validate JSON
      try {
        JSON.parse(value);
        setJsonError('');
      } catch (err) {
        setJsonError('Invalid JSON format');
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate JSON before submitting
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(formData.payloadJson);
    } catch (err) {
      setJsonError('Invalid JSON format');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name || null,
        isActive: formData.isActive,
        weight: parseInt(formData.weight.toString()),
        payload: parsedPayload,
        ctaText: formData.ctaText || null,
        ctaUrl: formData.ctaUrl || null,
        ctaType: formData.ctaType || null,
        ctaTarget: formData.ctaTarget || null,
        startAt: formData.startAt ? new Date(formData.startAt).toISOString() : null,
        endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
      };

      const url = isEditing
        ? `/api/carousels/variants/${variant.id}`
        : `/api/carousels/slides/${slideId}/variants`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to save variant');
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
            {isEditing ? 'Edit Variant' : 'New Variant'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update variant content and settings'
              : 'Create a new A/B test variant for the slide'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Variant Settings</CardTitle>
            <CardDescription>
              Configure this variant's behavior and visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Copy A, Version B"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">
                  Weight <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  min="1"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Higher weight = more likely to be shown
                </p>
              </div>
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
                Active (can be shown to users)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content (JSON Payload)</CardTitle>
            <CardDescription>
              Define the content structure for this variant. Supports headline, images, badges, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payloadJson">Payload JSON</Label>
              <Textarea
                id="payloadJson"
                name="payloadJson"
                value={formData.payloadJson}
                onChange={handleChange}
                rows={12}
                className="font-mono text-xs"
                placeholder='{"headline": "...", "image": {...}, ...}'
              />
              {jsonError && (
                <p className="text-xs text-red-600">{jsonError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Example structure: headline, subheadline, badge, image (desktop/mobile), theme (style/accent)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call to Action (CTA)</CardTitle>
            <CardDescription>
              Optional button or link for this variant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ctaText">CTA Text</Label>
                <Input
                  id="ctaText"
                  name="ctaText"
                  value={formData.ctaText}
                  onChange={handleChange}
                  placeholder="e.g., Shop Now, Learn More"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ctaUrl">CTA URL</Label>
                <Input
                  id="ctaUrl"
                  name="ctaUrl"
                  value={formData.ctaUrl}
                  onChange={handleChange}
                  placeholder="/products/... or https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ctaType">CTA Type</Label>
                <Select
                  value={formData.ctaType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, ctaType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ctaTarget">Link Target</Label>
                <Select
                  value={formData.ctaTarget}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, ctaTarget: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TARGETS.map((target) => (
                      <SelectItem key={target.value} value={target.value}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling (Optional)</CardTitle>
            <CardDescription>
              Override slide scheduling for this specific variant
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
            <Link href={`/carousels/${carouselId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving || !!jsonError}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEditing ? 'Update Variant' : 'Create Variant'}
          </Button>
        </div>
      </form>
    </div>
  );
}
