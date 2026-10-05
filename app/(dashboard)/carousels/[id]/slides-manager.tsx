'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

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

type SortHandleProps = {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  disabled: boolean;
};

function SortableSlide({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handleProps: SortHandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-60 z-10 relative' : ''}
    >
      {children({ attributes, listeners, disabled })}
    </div>
  );
}

export function SlidesManager({ carousel }: Props) {
  const router = useRouter();
  const [expandedSlides, setExpandedSlides] = useState<Set<string>>(new Set());
  const [slides, setSlides] = useState(carousel.slides);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setSlides(carousel.slides);
  }, [carousel.slides]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || isReordering) return;

    const oldIndex = slides.findIndex((slide) => slide.id === active.id);
    const newIndex = slides.findIndex((slide) => slide.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousSlides = slides;
    const reorderedSlides = arrayMove(slides, oldIndex, newIndex).map((slide, position) => ({
      ...slide,
      position,
    }));

    setSlides(reorderedSlides);
    setReorderError(null);
    setIsReordering(true);

    try {
      const res = await fetch(`/api/carousels/${carousel.id}/slides/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideIds: reorderedSlides.map((slide) => slide.id) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to reorder slides');
      }

      router.refresh();
    } catch (error) {
      setSlides(previousSlides);
      setReorderError(error instanceof Error ? error.message : 'Failed to reorder slides');
    } finally {
      setIsReordering(false);
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
        {reorderError && <p role="alert" className="text-sm text-destructive">{reorderError}</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
        {slides.map((slide) => {
          const isExpanded = expandedSlides.has(slide.id);

          return (
            <SortableSlide key={slide.id} id={slide.id} disabled={isReordering}>
              {({ attributes, listeners, disabled }) => <div className="border rounded-lg">
              {/* Slide Header */}
              <div className="p-4 flex items-center gap-3 bg-muted/30">
                <button
                  type="button"
                  className="touch-none cursor-grab rounded p-1 active:cursor-grabbing disabled:cursor-not-allowed"
                  aria-label={`Drag slide ${slide.position + 1} to reorder`}
                  title="Drag to reorder"
                  disabled={disabled}
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>
                
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
              </div>}
            </SortableSlide>
          );
        })}
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
