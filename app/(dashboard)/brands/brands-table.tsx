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
  ExternalLink,
  Search,
  Loader2,
  X,
} from 'lucide-react';
import Image from 'next/image';

type MediaAsset = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string | null;
  kind: string;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoMediaId: string | null;
  logoMedia: MediaAsset | null;
  websiteUrl: string | null;
  isFeatured: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    products: number;
  };
};

type Props = {
  initialBrands: Brand[];
  mediaAssets: MediaAsset[];
};

export function BrandsTable({ initialBrands, mediaAssets }: Props) {
  const router = useRouter();
  const t = useTranslations('brands');
  const tc = useTranslations('common');
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMediaPickerDialog, setShowMediaPickerDialog] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLogoMediaId, setFormLogoMediaId] = useState<string | null>(null);
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Media picker state
  const [mediaSearch, setMediaSearch] = useState('');

  const filteredBrands = brands.filter(
    (brand) =>
      brand.name.toLowerCase().includes(search.toLowerCase()) ||
      brand.slug.toLowerCase().includes(search.toLowerCase())
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
    if (!selectedBrand || !formSlug) {
      setFormSlug(generateSlug(name));
    }
  }

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormLogoMediaId(null);
    setFormWebsiteUrl('');
    setFormIsFeatured(false);
    setFormError(null);
    setMediaSearch('');
  }

  function openCreateDialog() {
    resetForm();
    setSelectedBrand(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(brand: Brand) {
    setSelectedBrand(brand);
    setFormName(brand.name);
    setFormSlug(brand.slug);
    setFormDescription(brand.description || '');
    setFormLogoMediaId(brand.logoMediaId);
    setFormWebsiteUrl(brand.websiteUrl || '');
    setFormIsFeatured(brand.isFeatured);
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(brand: Brand) {
    setSelectedBrand(brand);
    setShowDeleteDialog(true);
  }

  function getSelectedLogoMedia(): MediaAsset | null {
    if (!formLogoMediaId) return null;
    return mediaAssets.find((a) => a.id === formLogoMediaId) || null;
  }

  function selectLogoMedia(asset: MediaAsset) {
    setFormLogoMediaId(asset.id);
    setShowMediaPickerDialog(false);
    setMediaSearch('');
  }

  async function handleCreate() {
    if (!formName.trim() || !formSlug.trim()) {
      setFormError('Name and slug are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          logoMediaId: formLogoMediaId,
          websiteUrl: formWebsiteUrl.trim() || null,
          isFeatured: formIsFeatured,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create brand');
      }

      // Add logo media from our list if present
      const logoMedia = formLogoMediaId
        ? mediaAssets.find((a) => a.id === formLogoMediaId) || null
        : null;

      setBrands((prev) =>
        [...prev, { ...data, logoMedia, _count: { products: 0 } }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
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
    if (!selectedBrand) return;
    if (!formName.trim() || !formSlug.trim()) {
      setFormError('Name and slug are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/brands/${selectedBrand.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          logoMediaId: formLogoMediaId,
          websiteUrl: formWebsiteUrl.trim() || null,
          isFeatured: formIsFeatured,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update brand');
      }

      // Add logo media from our list if present
      const logoMedia = formLogoMediaId
        ? mediaAssets.find((a) => a.id === formLogoMediaId) || null
        : null;

      setBrands((prev) =>
        prev
          .map((b) =>
            b.id === selectedBrand.id ? { ...data, logoMedia, _count: b._count } : b
          )
          .sort((a, b) => a.name.localeCompare(b.name))
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
    if (!selectedBrand) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/brands/${selectedBrand.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete brand');
      }

      setBrands((prev) => prev.filter((b) => b.id !== selectedBrand.id));
      setShowDeleteDialog(false);
      setSelectedBrand(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedLogo = getSelectedLogoMedia();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Brands</CardTitle>
              <CardDescription>
                {brands.length} brand{brands.length !== 1 ? 's' : ''} total
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Brand
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search brands..."
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
                  <TableHead className="w-12">Logo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBrands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search ? 'No brands match your search.' : 'No brands found. Add your first brand!'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBrands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell>
                        {brand.logoMedia ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md bg-muted">
                            <Image
                              src={brand.logoMedia.thumbUrl || brand.logoMedia.url}
                              alt={brand.logoMedia.alt || brand.name}
                              fill
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium">
                            {brand.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{brand.name}</div>
                          {brand.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {brand.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm text-muted-foreground">{brand.slug}</code>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={brand._count.products > 0 ? 'default' : 'secondary'}>
                          {brand._count.products}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {brand.isFeatured ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {brand.websiteUrl ? (
                          <a
                            href={brand.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            Visit
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(brand)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(brand)}
                              className="text-red-600"
                              disabled={brand._count.products > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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
            <DialogTitle>Add New Brand</DialogTitle>
            <DialogDescription>
              Create a new brand to associate with products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Catan Studio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-slug">Slug *</Label>
              <Input
                id="create-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="e.g., catan-studio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Input
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of the brand"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {selectedLogo ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                    <Image
                      src={selectedLogo.thumbUrl || selectedLogo.url}
                      alt={selectedLogo.alt || 'Logo'}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1 text-sm truncate">
                    {selectedLogo.alt || 'Selected logo'}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormLogoMediaId(null)}
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
                  Select Logo from Media Gallery
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-website">Website URL</Label>
              <Input
                id="create-website"
                value={formWebsiteUrl}
                onChange={(e) => setFormWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-featured"
                checked={formIsFeatured}
                onChange={(e) => setFormIsFeatured(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="create-featured">Featured brand</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
            <DialogDescription>
              Update the brand information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug *</Label>
              <Input
                id="edit-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {selectedLogo ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                    <Image
                      src={selectedLogo.thumbUrl || selectedLogo.url}
                      alt={selectedLogo.alt || 'Logo'}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1 text-sm truncate">
                    {selectedLogo.alt || 'Selected logo'}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormLogoMediaId(null)}
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
                  Select Logo from Media Gallery
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website URL</Label>
              <Input
                id="edit-website"
                value={formWebsiteUrl}
                onChange={(e) => setFormWebsiteUrl(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-featured"
                checked={formIsFeatured}
                onChange={(e) => setFormIsFeatured(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-featured">Featured brand</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Brand</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBrand?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          {selectedBrand && selectedBrand._count.products > 0 && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              This brand has {selectedBrand._count.products} associated product(s). Please reassign or remove them before deleting this brand.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || (selectedBrand?._count.products ?? 0) > 0}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Picker Dialog */}
      <Dialog open={showMediaPickerDialog} onOpenChange={setShowMediaPickerDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Logo</DialogTitle>
            <DialogDescription>
              Choose an image from your media gallery for the brand logo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
              {filteredMediaAssets.length === 0 ? (
                <div className="col-span-4 text-center py-8 text-muted-foreground">
                  No images found. Upload images in the Media Gallery first.
                </div>
              ) : (
                filteredMediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => selectLogoMedia(asset)}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-colors hover:border-primary ${
                      formLogoMediaId === asset.id ? 'border-primary ring-2 ring-primary' : 'border-transparent'
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
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
