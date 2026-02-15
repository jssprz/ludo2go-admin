'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, Eye, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

type CarouselSlideVariant = {
  id: string;
  name: string | null;
  isActive: boolean;
  weight: number;
  payload: any;
  ctaText: string | null;
  ctaUrl: string | null;
};

type CarouselSlide = {
  id: string;
  position: number;
  isActive: boolean;
  name: string | null;
  startAt: Date | null;
  endAt: Date | null;
  variants: CarouselSlideVariant[];
};

type Carousel = {
  id: string;
  key: string;
  title: string | null;
  slides: CarouselSlide[];
};

type Props = {
  carousel: Carousel;
};

export function SlidesManager({ carousel }: Props) {
  const router = useRouter();
  const [expandedSlides, setExpandedSlides] = useState<Set<string>>(new Set());

  const toggleSlide = (slideId: string) => {
    const newExpanded = new Set(expandedSlides);
    if (newExpanded.has(slideId)) {
      newExpanded.delete(slideId);
    } else {
      newExpanded.add(slideId);
    }
    setExpandedSlides(newExpanded);
  };

  async function handleDeleteSlide(slideId: string) {
    if (!confirm('Are you sure? All variants for this slide will be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/carousels/slides/${slideId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete slide');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleToggleSlide(slideId: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/carousels/slides/${slideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update slide');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!confirm('Delete this variant?')) {
      return;
    }

    try {
      const res = await fetch(`/api/carousels/variants/${variantId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete variant');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleToggleVariant(variantId: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/carousels/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update variant');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleMoveSlide(slideId: string, direction: 'up' | 'down') {
    try {
      const res = await fetch(`/api/carousels/slides/${slideId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to move slide');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  if (carousel.slides.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Slides</CardTitle>
          <CardDescription>No slides yet. Create your first slide to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/carousels/${carousel.id}/slides/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Slide
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Slides ({carousel.slides.length})</CardTitle>
          <CardDescription>Manage slides and their A/B test variants</CardDescription>
        </div>
        <Button asChild>
          <Link href={`/carousels/${carousel.id}/slides/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Add Slide
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {carousel.slides.map((slide, index) => {
          const isExpanded = expandedSlides.has(slide.id);
          const canMoveUp = index > 0;
          const canMoveDown = index < carousel.slides.length - 1;

          return (
            <div key={slide.id} className="border rounded-lg">
              {/* Slide Header */}
              <div className="p-4 flex items-center gap-3 bg-muted/30">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      Slide {slide.position + 1}
                      {slide.name && `: ${slide.name}`}
                    </span>
                    <Badge variant={slide.isActive ? 'default' : 'secondary'} className="text-xs">
                      {slide.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {slide.variants.length} variant{slide.variants.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {(slide.startAt || slide.endAt) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {slide.startAt && `From: ${new Date(slide.startAt).toLocaleDateString()}`}
                      {slide.startAt && slide.endAt && ' • '}
                      {slide.endAt && `To: ${new Date(slide.endAt).toLocaleDateString()}`}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSlide(slide.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Slide Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!canMoveUp}
                      onClick={() => handleMoveSlide(slide.id, 'up')}
                    >
                      Move Up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canMoveDown}
                      onClick={() => handleMoveSlide(slide.id, 'down')}
                    >
                      Move Down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/carousels/${carousel.id}/slides/${slide.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Slide
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleSlide(slide.id, slide.isActive)}
                    >
                      {slide.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteSlide(slide.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Slide
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Variants */}
              {isExpanded && (
                <div className="p-4 space-y-3 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Variants (A/B Testing)</h4>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/carousels/${carousel.id}/slides/${slide.id}/variants/new`}>
                        <Plus className="mr-2 h-3 w-3" />
                        Add Variant
                      </Link>
                    </Button>
                  </div>

                  {slide.variants.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic py-2">
                      No variants yet. Add at least one variant for this slide to be displayed.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slide.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="flex items-center gap-3 p-3 border rounded-md bg-card"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {variant.name || 'Unnamed Variant'}
                              </span>
                              <Badge
                                variant={variant.isActive ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {variant.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Weight: {variant.weight}
                              </Badge>
                            </div>
                            {variant.ctaText && (
                              <div className="text-xs text-muted-foreground mt-1">
                                CTA: {variant.ctaText}
                              </div>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Variant Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/carousels/${carousel.id}/slides/${slide.id}/variants/${variant.id}/edit`}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Variant
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleVariant(variant.id, variant.isActive)}
                              >
                                {variant.isActive ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="text-red-600"
                                disabled={slide.variants.length === 1}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Variant
                              </DropdownMenuItem>
                              {slide.variants.length === 1 && (
                                <div className="px-2 py-1 text-xs text-muted-foreground">
                                  Cannot delete last variant
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
