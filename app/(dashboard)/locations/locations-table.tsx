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
  description: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isActive: boolean;
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
  const [formDescription, setFormDescription] = useState('');
  const [formAddressLine1, setFormAddressLine1] = useState('');
  const [formAddressLine2, setFormAddressLine2] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formPostalCode, setFormPostalCode] = useState('');
  const [formCountry, setFormCountry] = useState('CL');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.code.toLowerCase().includes(search.toLowerCase()) ||
      loc.addressLine1.toLowerCase().includes(search.toLowerCase()) ||
      loc.city.toLowerCase().includes(search.toLowerCase()) ||
      (loc.region && loc.region.toLowerCase().includes(search.toLowerCase())) ||
      loc.country.toLowerCase().includes(search.toLowerCase())
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
    setFormDescription('');
    setFormAddressLine1('');
    setFormAddressLine2('');
    setFormCity('');
    setFormRegion('');
    setFormPostalCode('');
    setFormCountry('CL');
    setFormLat('');
    setFormLng('');
    setFormPhone('');
    setFormIsActive(true);
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
    setFormDescription(location.description || '');
    setFormAddressLine1(location.addressLine1 || '');
    setFormAddressLine2(location.addressLine2 || '');
    setFormCity(location.city || '');
    setFormRegion(location.region || '');
    setFormPostalCode(location.postalCode || '');
    setFormCountry(location.country || 'CL');
    setFormLat(location.lat != null ? String(location.lat) : '');
    setFormLng(location.lng != null ? String(location.lng) : '');
    setFormPhone(location.phone || '');
    setFormIsActive(location.isActive);
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(location: Location) {
    setSelectedLocation(location);
    setShowDeleteDialog(true);
  }

  async function handleCreate() {
    if (!formCode.trim() || !formName.trim() || !formAddressLine1.trim() || !formCity.trim() || !formCountry.trim()) {
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
          description: formDescription.trim() || null,
          addressLine1: formAddressLine1.trim(),
          addressLine2: formAddressLine2.trim() || null,
          city: formCity.trim(),
          region: formRegion.trim() || null,
          postalCode: formPostalCode.trim() || null,
          country: formCountry.trim(),
          lat: formLat.trim() ? parseFloat(formLat.trim()) : null,
          lng: formLng.trim() ? parseFloat(formLng.trim()) : null,
          phone: formPhone.trim() || null,
          isActive: formIsActive,
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
    if (!formCode.trim() || !formName.trim() || !formAddressLine1.trim() || !formCity.trim() || !formCountry.trim()) {
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
          description: formDescription.trim() || null,
          addressLine1: formAddressLine1.trim(),
          addressLine2: formAddressLine2.trim() || null,
          city: formCity.trim(),
          region: formRegion.trim() || null,
          postalCode: formPostalCode.trim() || null,
          country: formCountry.trim(),
          lat: formLat.trim() ? parseFloat(formLat.trim()) : null,
          lng: formLng.trim() ? parseFloat(formLng.trim()) : null,
          phone: formPhone.trim() || null,
          isActive: formIsActive,
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
                  <TableHead>{t('addressLine1')}</TableHead>
                  <TableHead>{t('city')}</TableHead>
                  <TableHead>{t('country')}</TableHead>
                  <TableHead>{t('isActive')}</TableHead>
                  <TableHead className="text-center">{t('variantsCount')}</TableHead>
                  <TableHead className="text-center">{t('totalItems')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
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
                        {location.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {location.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {location.addressLine1}
                          {location.addressLine2 && (
                            <span className="text-muted-foreground">, {location.addressLine2}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{location.city}</span>
                        {location.region && (
                          <span className="text-sm text-muted-foreground">, {location.region}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{location.country}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.isActive ? 'default' : 'secondary'}>
                          {location.isActive ? t('active') : t('inactive')}
                        </Badge>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            {/* Name & Code */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="create-description">{t('description_field')}</Label>
              <Input
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            {/* Address Lines */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-addressLine1">{t('addressLine1')} *</Label>
                <Input
                  id="create-addressLine1"
                  value={formAddressLine1}
                  onChange={(e) => setFormAddressLine1(e.target.value)}
                  placeholder={t('addressLine1Placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-addressLine2">{t('addressLine2')}</Label>
                <Input
                  id="create-addressLine2"
                  value={formAddressLine2}
                  onChange={(e) => setFormAddressLine2(e.target.value)}
                  placeholder={t('addressLine2Placeholder')}
                />
              </div>
            </div>
            {/* City, Region, PostalCode */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-city">{t('city')} *</Label>
                <Input
                  id="create-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder={t('cityPlaceholder')}
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
              <div className="space-y-2">
                <Label htmlFor="create-postalCode">{t('postalCode')}</Label>
                <Input
                  id="create-postalCode"
                  value={formPostalCode}
                  onChange={(e) => setFormPostalCode(e.target.value)}
                  placeholder={t('postalCodePlaceholder')}
                />
              </div>
            </div>
            {/* Country & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-country">{t('country')} *</Label>
                <Input
                  id="create-country"
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value.toUpperCase())}
                  placeholder={t('countryPlaceholder')}
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground">{t('countryHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">{t('phone')}</Label>
                <Input
                  id="create-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                />
              </div>
            </div>
            {/* Lat & Lng */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-lat">{t('lat')}</Label>
                <Input
                  id="create-lat"
                  type="number"
                  step="any"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder={t('latPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-lng">{t('lng')}</Label>
                <Input
                  id="create-lng"
                  type="number"
                  step="any"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  placeholder={t('lngPlaceholder')}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('coordinatesHint')}</p>
            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <input
                id="create-isActive"
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="create-isActive">{t('isActive')}</Label>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            {/* Name & Code */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('description_field')}</Label>
              <Input
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            {/* Address Lines */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-addressLine1">{t('addressLine1')} *</Label>
                <Input
                  id="edit-addressLine1"
                  value={formAddressLine1}
                  onChange={(e) => setFormAddressLine1(e.target.value)}
                  placeholder={t('addressLine1Placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-addressLine2">{t('addressLine2')}</Label>
                <Input
                  id="edit-addressLine2"
                  value={formAddressLine2}
                  onChange={(e) => setFormAddressLine2(e.target.value)}
                  placeholder={t('addressLine2Placeholder')}
                />
              </div>
            </div>
            {/* City, Region, PostalCode */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">{t('city')} *</Label>
                <Input
                  id="edit-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder={t('cityPlaceholder')}
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
              <div className="space-y-2">
                <Label htmlFor="edit-postalCode">{t('postalCode')}</Label>
                <Input
                  id="edit-postalCode"
                  value={formPostalCode}
                  onChange={(e) => setFormPostalCode(e.target.value)}
                  placeholder={t('postalCodePlaceholder')}
                />
              </div>
            </div>
            {/* Country & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-country">{t('country')} *</Label>
                <Input
                  id="edit-country"
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value.toUpperCase())}
                  placeholder={t('countryPlaceholder')}
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground">{t('countryHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">{t('phone')}</Label>
                <Input
                  id="edit-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                />
              </div>
            </div>
            {/* Lat & Lng */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lat">{t('lat')}</Label>
                <Input
                  id="edit-lat"
                  type="number"
                  step="any"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder={t('latPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lng">{t('lng')}</Label>
                <Input
                  id="edit-lng"
                  type="number"
                  step="any"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  placeholder={t('lngPlaceholder')}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('coordinatesHint')}</p>
            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <input
                id="edit-isActive"
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-isActive">{t('isActive')}</Label>
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
