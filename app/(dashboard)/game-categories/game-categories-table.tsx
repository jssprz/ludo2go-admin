'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Loader2,
  X,
  GripVertical,
  Check,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';

type MediaAsset = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string | null;
  kind: string;
};

type GameCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  mediaId: string | null;
  media: MediaAsset | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    games: number;
  };
};

type Props = {
  initialCategories: GameCategory[];
  mediaAssets: MediaAsset[];
};

export function GameCategoriesTable({ initialCategories, mediaAssets }: Props) {
  const router = useRouter();
  const t = useTranslations('gameCategories');
  const tc = useTranslations('common');
  const [categories, setCategories] = useState<GameCategory[]>(initialCategories);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMediaPickerDialog, setShowMediaPickerDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formMediaId, setFormMediaId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Media picker state
  const [mediaSearch, setMediaSearch] = useState('');

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(search.toLowerCase()) ||
      category.slug.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMediaAssets = mediaAssets.filter(
    (asset) =>
      !mediaSearch ||
      (asset.alt && asset.alt.toLowerCase().includes(mediaSearch.toLowerCase())) ||
      asset.url.toLowerCase().includes(mediaSearch.toLowerCase())
  );

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleNameChange(name: string) {
    setFormName(name);
    // Auto-generate slug if creating new or slug is empty
    if (!selectedCategory || !formSlug) {
      setFormSlug(generateSlug(name));
    }
  }

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormIcon('');
    setFormOrder(categories.length);
    setFormIsActive(true);
    setFormMediaId(null);
    setFormError(null);
    setMediaSearch('');
  }

  function openCreateDialog() {
    resetForm();
    setSelectedCategory(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(category: GameCategory) {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormSlug(category.slug);
    setFormDescription(category.description || '');
    setFormIcon(category.icon || '');
    setFormOrder(category.order);
    setFormIsActive(category.isActive);
    setFormMediaId(category.mediaId);
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(category: GameCategory) {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  }

  function getSelectedMedia(): MediaAsset | null {
    if (!formMediaId) return null;
    return mediaAssets.find((a) => a.id === formMediaId) || null;
  }

  function selectMedia(asset: MediaAsset) {
    setFormMediaId(asset.id);
    setShowMediaPickerDialog(false);
    setMediaSearch('');
  }

  async function handleCreate() {
    if (!formName.trim() || !formSlug.trim()) {
      setFormError(t('nameSlugRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/game-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          icon: formIcon.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          mediaId: formMediaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      // Add media from our list if present
      const media = formMediaId
        ? mediaAssets.find((a) => a.id === formMediaId) || null
        : null;

      setCategories((prev) =>
        [...prev, { ...data, media, _count: { games: 0 } }].sort((a, b) => a.order - b.order)
      );
      setShowCreateDialog(false);
      resetForm();
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedCategory) return;
    if (!formName.trim() || !formSlug.trim()) {
      setFormError(t('nameSlugRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-categories/${selectedCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          icon: formIcon.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          mediaId: formMediaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update category');
      }

      // Add media from our list if present
      const media = formMediaId
        ? mediaAssets.find((a) => a.id === formMediaId) || null
        : null;

      setCategories((prev) =>
        prev
          .map((c) =>
            c.id === selectedCategory.id ? { ...data, media, _count: c._count } : c
          )
          .sort((a, b) => a.order - b.order)
      );
      setShowEditDialog(false);
      resetForm();
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-categories/${selectedCategory.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete category');
      }

      setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id));
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(category: GameCategory) {
    setIsLoading(true);

    try {
      const res = await fetch(`/api/game-categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          order: category.order,
          isActive: !category.isActive,
          mediaId: category.mediaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update category');
      }

      setCategories((prev) =>
        prev.map((c) =>
          c.id === category.id ? { ...c, isActive: !c.isActive } : c
        )
      );
      router.refresh();
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedMedia = getSelectedMedia();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('allCategories')}</CardTitle>
              <CardDescription>
                {categories.length} {t('categoriesTotal', { count: categories.length })}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addCategory')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('order')}</TableHead>
                  <TableHead className="w-12">{t('image')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('slug')}</TableHead>
                  <TableHead>{t('icon')}</TableHead>
                  <TableHead className="text-center">{t('games')}</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? t('noResultsSearch') : t('noCategories')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{category.order}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {category.media ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md bg-muted">
                            <Image
                              src={category.media.thumbUrl || category.media.url}
                              alt={category.media.alt || category.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium">
                            {category.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {category.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm text-muted-foreground">{category.slug}</code>
                      </TableCell>
                      <TableCell>
                        {category.icon ? (
                          <code className="text-sm">{category.icon}</code>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={category._count.games > 0 ? 'default' : 'secondary'}>
                          {category._count.games}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(category)}
                          disabled={isLoading}
                        >
                          {category.isActive ? (
                            <Badge variant="default" className="gap-1">
                              <Check className="h-3 w-3" />
                              {t('active')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {t('inactive')}
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(category)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(category)}
                              className="text-red-600"
                              disabled={category._count.games > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tc('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('addCategory')}</DialogTitle>
            <DialogDescription>
              {t('createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-name">{t('name')} *</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-slug">{t('slug')} *</Label>
              <Input
                id="create-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder={t('slugPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">{t('descriptionLabel')}</Label>
              <Input
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-icon">{t('icon')}</Label>
              <Input
                id="create-icon"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder={t('iconPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-order">{t('order')}</Label>
              <Input
                id="create-order"
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('image')}</Label>
              {selectedMedia ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                    <Image
                      src={selectedMedia.thumbUrl || selectedMedia.url}
                      alt={selectedMedia.alt || 'Image'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 text-sm truncate">
                    {selectedMedia.alt || t('selectedImage')}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormMediaId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowMediaPickerDialog(true)}
                >
                  {t('selectImage')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="create-active">{t('activeCategory')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createCategory')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editCategory')}</DialogTitle>
            <DialogDescription>
              {t('editDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('name')} *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">{t('slug')} *</Label>
              <Input
                id="edit-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('descriptionLabel')}</Label>
              <Input
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-icon">{t('icon')}</Label>
              <Input
                id="edit-icon"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-order">{t('order')}</Label>
              <Input
                id="edit-order"
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('image')}</Label>
              {selectedMedia ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                    <Image
                      src={selectedMedia.thumbUrl || selectedMedia.url}
                      alt={selectedMedia.alt || 'Image'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 text-sm truncate">
                    {selectedMedia.alt || t('selectedImage')}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormMediaId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowMediaPickerDialog(true)}
                >
                  {t('selectImage')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active">{t('activeCategory')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteCategory')}</DialogTitle>
            <DialogDescription>
              {t('confirmDelete', { name: selectedCategory?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          {selectedCategory && selectedCategory._count.games > 0 && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              {t('cannotDeleteWithGames', { count: selectedCategory._count.games })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || (selectedCategory?._count.games ?? 0) > 0}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Picker Dialog */}
      <Dialog open={showMediaPickerDialog} onOpenChange={setShowMediaPickerDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('selectImage')}</DialogTitle>
            <DialogDescription>
              {t('selectImageDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchMedia')}
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
              {filteredMediaAssets.length === 0 ? (
                <div className="col-span-4 text-center py-8 text-muted-foreground">
                  {t('noMediaFound')}
                </div>
              ) : (
                filteredMediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => selectMedia(asset)}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-colors hover:border-primary ${
                      formMediaId === asset.id ? 'border-primary ring-2 ring-primary' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={asset.thumbUrl || asset.url}
                      alt={asset.alt || 'Media asset'}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMediaPickerDialog(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
