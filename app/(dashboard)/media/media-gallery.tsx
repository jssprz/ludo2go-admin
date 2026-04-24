'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Box,
  Grid,
  List,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type MediaAsset = {
  id: string;
  kind: 'image' | 'video' | 'pdf' | 'audio' | 'model3d';
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  mime: string | null;
  locale: string | null;
  alt: string | null;
  copyright: string | null;
  createdAt: string;
  _count: {
    productRefs: number;
    variantRefs: number;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function MediaGallery() {
  const router = useRouter();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Edit dialog state
  const [editingMedia, setEditingMedia] = useState<MediaAsset | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editCopyright, setEditCopyright] = useState('');
  const [editLocale, setEditLocale] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Preview dialog state
  const [previewMedia, setPreviewMedia] = useState<MediaAsset | null>(null);

  const fetchMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) params.set('search', searchQuery);
      if (kindFilter !== 'all') params.set('kind', kindFilter);

      const res = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error('Failed to fetch media');

      const data = await res.json();
      setMedia(data.media);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, kindFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((p) => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`Uploading 0/${files.length}...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);

        const timestamp = Date.now();
        const kind = file.type.startsWith('video/')
          ? 'video'
          : file.type === 'application/pdf'
            ? 'pdf'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'image';

        await upload(`media/${kind}/${timestamp}-${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/media/upload',
          clientPayload: JSON.stringify({
            sizeBytes: file.size,
            mime: file.type,
          }),
        });
      }

      // Refresh the gallery
      fetchMedia();
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      // Reset the input
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this media asset?')) return;

    try {
      const res = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Delete failed');
      }

      fetchMedia();
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Delete failed');
    }
  }

  function openEditDialog(media: MediaAsset) {
    setEditingMedia(media);
    setEditAlt(media.alt || '');
    setEditCopyright(media.copyright || '');
    setEditLocale(media.locale || '');
  }

  async function handleSaveEdit() {
    if (!editingMedia) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${editingMedia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alt: editAlt || null,
          copyright: editCopyright || null,
          locale: editLocale || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Update failed');
      }

      setEditingMedia(null);
      fetchMedia();
    } catch (error: any) {
      alert(error.message || 'Update failed');
    } finally {
      setIsSaving(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getMediaIcon(kind: string) {
    switch (kind) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'model3d':
        return <Box className="h-4 w-4" />;
      default:
        return <ImageIcon className="h-4 w-4" />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by alt text, URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="pdf">PDFs</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <label htmlFor="media-upload">
            <Button asChild disabled={isUploading}>
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadProgress || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Media
                  </>
                )}
              </span>
            </Button>
          </label>
          <input
            id="media-upload"
            type="file"
            accept="image/*,video/*,application/pdf,audio/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : media.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No media found</p>
          <p className="text-sm">Upload some media to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative border rounded-lg overflow-hidden bg-muted/50 aspect-square cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setPreviewMedia(item)}
            >
              {item.kind === 'image' ? (
                <Image
                  src={item.thumbUrl || item.url}
                  alt={item.alt || 'Media'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  {getMediaIcon(item.kind)}
                  <span className="text-xs uppercase">{item.kind}</span>
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div className="text-white text-xs truncate flex-1">
                  {item.alt || 'No alt text'}
                </div>
              </div>

              {/* Action menu */}
              <div
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => copyToClipboard(item.url)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Original
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Metadata
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600"
                      disabled={
                        item._count.productRefs + item._count.variantRefs > 0
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Usage badge */}
              {item._count.productRefs + item._count.variantRefs > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute bottom-2 left-2 text-xs"
                >
                  In use
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {media.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
              onClick={() => setPreviewMedia(item)}
            >
              <div className="relative h-16 w-16 rounded overflow-hidden bg-muted flex-shrink-0">
                {item.kind === 'image' ? (
                  <Image
                    src={item.thumbUrl || item.url}
                    alt={item.alt || 'Media'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {getMediaIcon(item.kind)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.alt || 'No alt text'}</p>
                <p className="text-sm text-muted-foreground truncate">{item.url}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.kind}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(item.sizeBytes)}
                  </span>
                  {item.width && item.height && (
                    <span className="text-xs text-muted-foreground">
                      {item.width}×{item.height}
                    </span>
                  )}
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => copyToClipboard(item.url)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Metadata
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600"
                      disabled={
                        item._count.productRefs + item._count.variantRefs > 0
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingMedia} onOpenChange={() => setEditingMedia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media Metadata</DialogTitle>
            <DialogDescription>
              Update the metadata for this media asset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-alt">Alt Text</Label>
              <Input
                id="edit-alt"
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                placeholder="Describe the image for accessibility"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-copyright">Copyright</Label>
              <Input
                id="edit-copyright"
                value={editCopyright}
                onChange={(e) => setEditCopyright(e.target.value)}
                placeholder="© 2026 Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-locale">Locale</Label>
              <Input
                id="edit-locale"
                value={editLocale}
                onChange={(e) => setEditLocale(e.target.value)}
                placeholder="e.g., en, es, fr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMedia(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewMedia?.alt || 'Media Preview'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewMedia?.kind === 'image' ? (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <Image
                  src={previewMedia.url}
                  alt={previewMedia.alt || 'Preview'}
                  fill
                  className="object-contain"
                />
              </div>
            ) : previewMedia?.kind === 'video' ? (
              <video
                src={previewMedia.url}
                controls
                className="w-full rounded-lg"
              />
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                {getMediaIcon(previewMedia?.kind || 'image')}
                <span className="ml-2">Preview not available</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{previewMedia?.kind}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="font-medium">{formatBytes(previewMedia?.sizeBytes || null)}</p>
              </div>
              {previewMedia?.width && previewMedia?.height && (
                <div>
                  <p className="text-muted-foreground">Dimensions</p>
                  <p className="font-medium">
                    {previewMedia.width} × {previewMedia.height}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">MIME Type</p>
                <p className="font-medium">{previewMedia?.mime || 'Unknown'}</p>
              </div>
              {previewMedia?.copyright && (
                <div>
                  <p className="text-muted-foreground">Copyright</p>
                  <p className="font-medium">{previewMedia.copyright}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {previewMedia?.createdAt
                    ? new Date(previewMedia.createdAt).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(previewMedia?.url || '')}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(previewMedia?.url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Original
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (previewMedia) openEditDialog(previewMedia);
                  setPreviewMedia(null);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Metadata
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
