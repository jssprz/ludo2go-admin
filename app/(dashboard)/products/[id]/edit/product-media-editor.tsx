'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GripVertical,
  Plus,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

type MediaAsset = {
  id: string;
  kind: 'image' | 'video' | 'pdf' | 'audio' | 'model3d';
  url: string;
  thumbUrl: string | null;
  alt: string | null;
};

type ProductMedia = {
  productId: string;
  mediaId: string;
  role: string | null;
  sort: number | null;
  media: MediaAsset;
};

type Props = {
  productId: string;
};

const MEDIA_ROLES = [
  { value: 'primary', label: 'Primary' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'components', label: 'Components' },
  { value: 'packaging', label: 'Packaging' },
];

export function ProductMediaEditor({ productId }: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Media picker dialog
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());
  const [isAddingMedia, setIsAddingMedia] = useState(false);

  const fetchProductMedia = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/media`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();
      setMedia(data);
    } catch (error) {
      console.error('Error fetching product media:', error);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProductMedia();
  }, [fetchProductMedia]);

  // Fetch available media for picker
  const fetchAvailableMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        kind: 'image', // Only show images for now
      });
      if (mediaSearch) params.set('search', mediaSearch);

      const res = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();

      // Filter out media already attached to this product
      const attachedIds = new Set(media.map((m) => m.mediaId));
      const filtered = data.media.filter(
        (m: MediaAsset) => !attachedIds.has(m.id)
      );
      setAvailableMedia(filtered);
    } catch (error) {
      console.error('Error fetching available media:', error);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [mediaSearch, media]);

  useEffect(() => {
    if (showMediaPicker) {
      fetchAvailableMedia();
    }
  }, [showMediaPicker, fetchAvailableMedia]);

  // Debounced search
  useEffect(() => {
    if (!showMediaPicker) return;
    const timer = setTimeout(() => {
      fetchAvailableMedia();
    }, 300);
    return () => clearTimeout(timer);
  }, [mediaSearch, showMediaPicker, fetchAvailableMedia]);

  function togglePickerSelection(mediaId: string) {
    setSelectedPickerIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  }

  async function handleAddSelectedMedia() {
    if (selectedPickerIds.size === 0) return;

    setIsAddingMedia(true);
    const errors: string[] = [];
    const added: ProductMedia[] = [];

    const idsToAdd = Array.from(selectedPickerIds);

    for (const mediaId of idsToAdd) {
      try {
        const res = await fetch(`/api/products/${productId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            role: 'gallery',
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          errors.push(error.message || `Failed to add media ${mediaId}`);
          continue;
        }

        const newProductMedia = await res.json();
        added.push(newProductMedia);
      } catch (error: any) {
        errors.push(error.message || `Failed to add media ${mediaId}`);
      }
    }

    if (added.length > 0) {
      setMedia((prev) => [...prev, ...added]);
    }

    if (errors.length > 0) {
      alert(`Some media could not be added:\n${errors.join('\n')}`);
    }

    setSelectedPickerIds(new Set());
    setShowMediaPicker(false);
    setIsAddingMedia(false);
    router.refresh();
  }

  async function handleRemoveMedia(mediaId: string) {
    if (!confirm('Remove this media from the product?')) return;

    try {
      const res = await fetch(
        `/api/products/${productId}/media?mediaId=${mediaId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to remove media');
      }

      setMedia(media.filter((m) => m.mediaId !== mediaId));
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to remove media');
    }
  }

  function handleRoleChange(mediaId: string, role: string) {
    setMedia(
      media.map((m) =>
        m.mediaId === mediaId ? { ...m, role: role || null } : m
      )
    );
    setHasChanges(true);
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newMedia = [...media];
    [newMedia[index - 1], newMedia[index]] = [
      newMedia[index],
      newMedia[index - 1],
    ];
    // Update sort values
    newMedia.forEach((m, i) => {
      m.sort = i;
    });
    setMedia(newMedia);
    setHasChanges(true);
  }

  function handleMoveDown(index: number) {
    if (index === media.length - 1) return;
    const newMedia = [...media];
    [newMedia[index], newMedia[index + 1]] = [
      newMedia[index + 1],
      newMedia[index],
    ];
    // Update sort values
    newMedia.forEach((m, i) => {
      m.sort = i;
    });
    setMedia(newMedia);
    setHasChanges(true);
  }

  async function handleSaveChanges() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/media`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media: media.map((m, index) => ({
            mediaId: m.mediaId,
            role: m.role,
            sort: index,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save changes');
      }

      setHasChanges(false);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  function getMediaIcon(kind: string) {
    switch (kind) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      default:
        return <ImageIcon className="h-4 w-4" />;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Product Media</h3>
          <p className="text-sm text-muted-foreground">
            Manage images and videos for this product
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Order & Roles'
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowMediaPicker(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Media
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No media attached</p>
          <p className="text-sm">Add images or videos to this product</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setShowMediaPicker(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Media
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {media.map((item, index) => (
            <div
              key={item.mediaId}
              className="flex items-center gap-4 p-4 hover:bg-muted/50"
            >
              {/* Drag handle / position controls */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === media.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              {/* Thumbnail */}
              <div className="relative h-16 w-16 rounded overflow-hidden bg-muted flex-shrink-0">
                {item.media.kind === 'image' ? (
                  <Image
                    src={item.media.thumbUrl || item.media.url}
                    alt={item.media.alt || 'Media'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {getMediaIcon(item.media.kind)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {item.media.alt || 'Untitled'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {item.media.url}
                </p>
              </div>

              {/* Role selector */}
              <Select
                value={item.role || 'none'}
                onValueChange={(value) => handleRoleChange(item.mediaId, value === 'none' ? '' : value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {MEDIA_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Position badge */}
              <Badge variant="outline" className="w-8 justify-center">
                {index + 1}
              </Badge>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => window.open(item.media.url, '_blank')}
                  >
                    View Original
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRemoveMedia(item.mediaId)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Media Picker Dialog */}
      <Dialog open={showMediaPicker} onOpenChange={(open) => {
        setShowMediaPicker(open);
        if (!open) setSelectedPickerIds(new Set());
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Media</DialogTitle>
            <DialogDescription>
              Select media from your library to add to this product
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {isLoadingMedia ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableMedia.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No media available</p>
                <p className="text-sm">
                  Upload media in the Media Gallery first
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 p-1">
                {availableMedia.map((asset) => {
                  const isSelected = selectedPickerIds.has(asset.id);
                  return (
                    <div
                      key={asset.id}
                      className={`relative aspect-square border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                      onClick={() => togglePickerSelection(asset.id)}
                    >
                      {asset.kind === 'image' ? (
                        <Image
                          src={asset.thumbUrl || asset.url}
                          alt={asset.alt || 'Media'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                          {getMediaIcon(asset.kind)}
                        </div>
                      )}
                      {/* Selection overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="rounded-full bg-primary p-1">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedPickerIds.size > 0
                ? `${selectedPickerIds.size} item${selectedPickerIds.size > 1 ? 's' : ''} selected`
                : 'Click to select media'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPickerIds(new Set());
                  setShowMediaPicker(false);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={selectedPickerIds.size === 0 || isAddingMedia}
                onClick={handleAddSelectedMedia}
              >
                {isAddingMedia ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {selectedPickerIds.size > 0 ? `(${selectedPickerIds.size})` : ''}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
