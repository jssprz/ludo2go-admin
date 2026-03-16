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
} from 'lucide-react';

type Location = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  region: string | null;
  createdAt: Date;
  updatedAt: Date;
  variantsCount: number;
  totalItems: number;
};

type Props = {
  initialLocations: Location[];
};

export function LocationsTable({ initialLocations }: Props) {
  const router = useRouter();
  const t = useTranslations('locations');
  const tc = useTranslations('common');
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.code.toLowerCase().includes(search.toLowerCase()) ||
      (loc.address && loc.address.toLowerCase().includes(search.toLowerCase())) ||
      (loc.region && loc.region.toLowerCase().includes(search.toLowerCase()))
  );

  function generateCode(name: string) {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleNameChange(name: string) {
    setFormName(name);
    if (!selectedLocation || !formCode) {
      setFormCode(generateCode(name));
    }
  }

  function resetForm() {
    setFormCode('');
    setFormName('');
    setFormAddress('');
    setFormRegion('');
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedLocation(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(location: Location) {
    setSelectedLocation(location);
    setFormCode(location.code);
    setFormName(location.name);
    setFormAddress(location.address || '');
    setFormRegion(location.region || '');
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(location: Location) {
    setSelectedLocation(location);
    setShowDeleteDialog(true);
  }

  async function handleCreate() {
    if (!formCode.trim() || !formName.trim()) {
      setFormError(t('codeNameRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          address: formAddress.trim() || null,
          region: formRegion.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create location');
      }

      setLocations((prev) =>
        [...prev, { ...data, _count: { inventories: 0 } }].sort((a, b) =>
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
    if (!selectedLocation) return;
    if (!formCode.trim() || !formName.trim()) {
      setFormError(t('codeNameRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/locations/${selectedLocation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          address: formAddress.trim() || null,
          region: formRegion.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update location');
      }

      setLocations((prev) =>
        prev
          .map((loc) =>
            loc.id === selectedLocation.id
              ? { ...data }
              : loc
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
    if (!selectedLocation) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/locations/${selectedLocation.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete location');
      }

      setLocations((prev) =>
        prev.filter((loc) => loc.id !== selectedLocation.id)
      );
      setShowDeleteDialog(false);
      setSelectedLocation(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('allLocations')}</CardTitle>
              <CardDescription>
                {locations.length} {t('locationsTotal', { count: locations.length })}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addLocation')}
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
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('address')}</TableHead>
                  <TableHead>{t('region')}</TableHead>
                  <TableHead className="text-center">{t('variantsCount')}</TableHead>
                  <TableHead className="text-center">{t('totalItems')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {search ? t('noResultsSearch') : t('noLocations')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell>
                        <code className="text-sm font-mono">{location.code}</code>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{location.name}</div>
                      </TableCell>
                      <TableCell>
                        {location.address ? (
                          <span className="text-sm text-muted-foreground">
                            {location.address}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {location.region ? (
                          <Badge variant="outline">{location.region}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            location.variantsCount > 0
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {location.variantsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            location.totalItems > 0
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {location.totalItems}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(location)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(location)}
                              className="text-red-600"
                              disabled={location.totalItems > 0}
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
            <DialogTitle>{t('addLocation')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
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
              <Label htmlFor="create-code">{t('code')} *</Label>
              <Input
                id="create-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder={t('codePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('codeHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-address">{t('address')}</Label>
              <Input
                id="create-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder={t('addressPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-region">{t('region')}</Label>
              <Input
                id="create-region"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder={t('regionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('creating')}
                </>
              ) : (
                tc('create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editLocation')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
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
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">{t('code')} *</Label>
              <Input
                id="edit-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder={t('codePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('codeHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">{t('address')}</Label>
              <Input
                id="edit-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder={t('addressPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-region">{t('region')}</Label>
              <Input
                id="edit-region"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder={t('regionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('saving')}
                </>
              ) : (
                tc('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirmation', {
                name: selectedLocation?.name || '',
              })}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('deleting')}
                </>
              ) : (
                tc('delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
