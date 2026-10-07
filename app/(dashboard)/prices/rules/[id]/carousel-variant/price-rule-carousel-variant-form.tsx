'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  ruleId: string;
  ruleActive: boolean;
  carousels: Array<{
    id: string; key: string; title: string | null;
    slides: Array<{ id: string; position: number; name: string | null; isActive: boolean }>;
  }>;
  preview: { headline: string; badge: string; subheadline: string };
};

export function PriceRuleCarouselVariantForm({ ruleId, ruleActive, carousels, preview }: Props) {
  const router = useRouter();
  const [slideId, setSlideId] = useState('');
  const [desktopImage, setDesktopImage] = useState('');
  const [mobileImage, setMobileImage] = useState('');
  const [ctaText, setCtaText] = useState('Ver oferta');
  const [ctaUrl, setCtaUrl] = useState('/');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slides = carousels.flatMap((carousel) => carousel.slides.map((slide) => ({
    ...slide, carouselLabel: carousel.title || carousel.key,
  })));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slideId) {
      setError('Choose a carousel slide.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/prices/rules/${ruleId}/carousel-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideId, desktopImage, mobileImage, ctaText, ctaUrl }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not create carousel variant.');
      router.push(`/carousels/${result.carouselId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create carousel variant.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Price rule content</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <span className="rounded-sm bg-secondary px-2 py-1">{preview.badge}</span>
            <span>{ruleActive ? 'Variant will be active' : 'Rule is inactive or not applied; variant will be inactive'}</span>
          </div>
          <h2 className="text-xl font-semibold">{preview.headline}</h2>
          <p className="text-sm text-muted-foreground">{preview.subheadline}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Placement and artwork</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-slide">Carousel slide</Label>
            <Select value={slideId} onValueChange={setSlideId}>
              <SelectTrigger id="rule-slide"><SelectValue placeholder="Choose a carousel slide" /></SelectTrigger>
              <SelectContent>
                {slides.map((slide) => (
                  <SelectItem key={slide.id} value={slide.id}>
                    {slide.carouselLabel} / {slide.name || `Slide ${slide.position}`}{slide.isActive ? '' : ' (inactive)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {slides.length === 0 && <p className="text-sm text-destructive">Create a carousel slide before adding this variant.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-desktop-image">Desktop image URL</Label>
              <Input id="rule-desktop-image" type="url" value={desktopImage} onChange={(event) => setDesktopImage(event.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-mobile-image">Mobile image URL</Label>
              <Input id="rule-mobile-image" type="url" value={mobileImage} onChange={(event) => setMobileImage(event.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-cta-text">Button text</Label>
              <Input id="rule-cta-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-cta-url">Button destination</Label>
              <Input id="rule-cta-url" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="/ or https://..." required />
            </div>
          </div>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || slides.length === 0 || !slideId}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          Create variant
        </Button>
      </div>
    </form>
  );
}