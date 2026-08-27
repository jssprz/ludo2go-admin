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
import { Textarea } from '@/components/ui/textarea';
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
  GripVertical,
  Check,
  XCircle,
} from 'lucide-react';

type GameTheme = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  title: string | null;
  subtitle: string | null;
  emotional: string | null;
  benefits: string[];
  urgency: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    games: number;
    expansions: number;
  };
  games?: Array<{
    productId: string;
    product: {
      name: string;
    };
  }>;
  expansions?: Array<{
    productId: string;
    product: {
      name: string;
    };
  }>;
};

type CatalogOption = {
  id: string;
  name: string;
};

type Props = {
  initialThemes: GameTheme[];
  availableGames: CatalogOption[];
  availableExpansions: CatalogOption[];
};

export function GameThemesTable({ initialThemes, availableGames, availableExpansions }: Props) {
  const router = useRouter();
  const t = useTranslations('gameThemes');
  const tc = useTranslations('common');
  const [themes, setThemes] = useState<GameTheme[]>(initialThemes);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<GameTheme | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formEmotional, setFormEmotional] = useState('');
  const [formBenefits, setFormBenefits] = useState('');
  const [formUrgency, setFormUrgency] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formGameIds, setFormGameIds] = useState<string[]>([]);
  const [formExpansionIds, setFormExpansionIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function parseBenefits(value: string): string[] {
    return Array.from(
      new Set(
        value
          .split(/\r?\n|,/) 
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
  }

  function toggleSelection(list: string[], id: string): string[] {
    if (list.includes(id)) {
      return list.filter((item) => item !== id);
    }

    return [...list, id];
  }

  const filteredThemes = themes.filter(
    (theme) =>
      theme.name.toLowerCase().includes(search.toLowerCase()) ||
      theme.slug.toLowerCase().includes(search.toLowerCase())
  );

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleNameChange(name: string) {
    setFormName(name);
    if (!selectedTheme || !formSlug) {
      setFormSlug(generateSlug(name));
    }
  }

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormTitle('');
    setFormSubtitle('');
    setFormEmotional('');
    setFormBenefits('');
    setFormUrgency('');
    setFormIcon('');
    setFormOrder(themes.length);
    setFormIsActive(true);
    setFormGameIds([]);
    setFormExpansionIds([]);
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedTheme(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(theme: GameTheme) {
    setSelectedTheme(theme);
    setFormName(theme.name);
    setFormSlug(theme.slug);
    setFormDescription(theme.description || '');
    setFormTitle(theme.title || '');
    setFormSubtitle(theme.subtitle || '');
    setFormEmotional(theme.emotional || '');
    setFormBenefits((theme.benefits || []).join('\n'));
    setFormUrgency(theme.urgency || '');
    setFormIcon(theme.icon || '');
    setFormOrder(theme.order);
    setFormIsActive(theme.isActive);
    setFormGameIds(theme.games?.map((game) => game.productId) ?? []);
    setFormExpansionIds(theme.expansions?.map((expansion) => expansion.productId) ?? []);
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(theme: GameTheme) {
    setSelectedTheme(theme);
    setShowDeleteDialog(true);
  }

  async function handleCreate() {
    if (!formName.trim() || !formSlug.trim()) {
      setFormError(t('nameSlugRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/game-themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          title: formTitle.trim() || null,
          subtitle: formSubtitle.trim() || null,
          emotional: formEmotional.trim() || null,
          benefits: parseBenefits(formBenefits),
          urgency: formUrgency.trim() || null,
          icon: formIcon.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          gameIds: formGameIds,
          expansionIds: formExpansionIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create theme');
      }

      setThemes((prev) =>
        [...prev, { ...data, _count: { games: 0, expansions: 0 } }].sort((a, b) => a.order - b.order)
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
    if (!selectedTheme) return;
    if (!formName.trim() || !formSlug.trim()) {
      setFormError(t('nameSlugRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-themes/${selectedTheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          title: formTitle.trim() || null,
          subtitle: formSubtitle.trim() || null,
          emotional: formEmotional.trim() || null,
          benefits: parseBenefits(formBenefits),
          urgency: formUrgency.trim() || null,
          icon: formIcon.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          gameIds: formGameIds,
          expansionIds: formExpansionIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update theme');
      }

      setThemes((prev) =>
        prev
          .map((t) =>
            t.id === selectedTheme.id ? { ...data, _count: t._count } : t
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
    if (!selectedTheme) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-themes/${selectedTheme.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete theme');
      }

      setThemes((prev) => prev.filter((t) => t.id !== selectedTheme.id));
      setShowDeleteDialog(false);
      setSelectedTheme(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(theme: GameTheme) {
    setIsLoading(true);

    try {
      const res = await fetch(`/api/game-themes/${theme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: theme.name,
          slug: theme.slug,
          description: theme.description,
          title: theme.title,
          subtitle: theme.subtitle,
          emotional: theme.emotional,
          benefits: theme.benefits,
          urgency: theme.urgency,
          icon: theme.icon,
          order: theme.order,
          isActive: !theme.isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update theme');
      }

      setThemes((prev) =>
        prev.map((t) =>
          t.id === theme.id ? { ...t, isActive: !t.isActive } : t
        )
      );
      router.refresh();
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
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
              <CardTitle>{t('allThemes')}</CardTitle>
              <CardDescription>
                {themes.length} {t('themesTotal', { count: themes.length })}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addTheme')}
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
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('slug')}</TableHead>
                  <TableHead>{t('icon')}</TableHead>
                  <TableHead className="text-center">{t('games')}</TableHead>
                  <TableHead className="text-center">Expansions</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThemes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? t('noResultsSearch') : t('noThemes')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredThemes.map((theme) => (
                    <TableRow key={theme.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{theme.order}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{theme.name}</div>
                          {theme.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {theme.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm text-muted-foreground">{theme.slug}</code>
                      </TableCell>
                      <TableCell>
                        {theme.icon ? (
                          <code className="text-sm">{theme.icon}</code>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={theme._count.games > 0 ? 'default' : 'secondary'}>
                          {theme._count.games}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={theme._count.expansions > 0 ? 'default' : 'secondary'}>
                          {theme._count.expansions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(theme)}
                          disabled={isLoading}
                        >
                          {theme.isActive ? (
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
                            <DropdownMenuItem onClick={() => openEditDialog(theme)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(theme)}
                              className="text-red-600"
                              disabled={theme._count.games > 0 || theme._count.expansions > 0}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('addTheme')}</DialogTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-title">Title</Label>
                <Input
                  id="create-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Optional title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-subtitle">Subtitle</Label>
                <Input
                  id="create-subtitle"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Optional subtitle"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-emotional">Emotional</Label>
              <Textarea
                id="create-emotional"
                value={formEmotional}
                onChange={(e) => setFormEmotional(e.target.value)}
                placeholder="Emotional hook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-benefits">Benefits (comma or new line separated)</Label>
              <Textarea
                id="create-benefits"
                value={formBenefits}
                onChange={(e) => setFormBenefits(e.target.value)}
                placeholder="Story driven, immersive, replayable"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-urgency">Urgency</Label>
              <Input
                id="create-urgency"
                value={formUrgency}
                onChange={(e) => setFormUrgency(e.target.value)}
                placeholder="Why play now"
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="create-active">{t('activeTheme')}</Label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign Games ({formGameIds.length})</Label>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                  {availableGames.map((game) => (
                    <label key={game.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formGameIds.includes(game.id)}
                        onChange={() => setFormGameIds((prev) => toggleSelection(prev, game.id))}
                      />
                      <span>{game.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign Expansions ({formExpansionIds.length})</Label>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                  {availableExpansions.map((expansion) => (
                    <label key={expansion.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formExpansionIds.includes(expansion.id)}
                        onChange={() => setFormExpansionIds((prev) => toggleSelection(prev, expansion.id))}
                      />
                      <span>{expansion.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createTheme')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editTheme')}</DialogTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subtitle">Subtitle</Label>
                <Input
                  id="edit-subtitle"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-emotional">Emotional</Label>
              <Textarea
                id="edit-emotional"
                value={formEmotional}
                onChange={(e) => setFormEmotional(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-benefits">Benefits (comma or new line separated)</Label>
              <Textarea
                id="edit-benefits"
                value={formBenefits}
                onChange={(e) => setFormBenefits(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-urgency">Urgency</Label>
              <Input
                id="edit-urgency"
                value={formUrgency}
                onChange={(e) => setFormUrgency(e.target.value)}
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active">{t('activeTheme')}</Label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign Games ({formGameIds.length})</Label>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                  {availableGames.map((game) => (
                    <label key={game.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formGameIds.includes(game.id)}
                        onChange={() => setFormGameIds((prev) => toggleSelection(prev, game.id))}
                      />
                      <span>{game.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign Expansions ({formExpansionIds.length})</Label>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                  {availableExpansions.map((expansion) => (
                    <label key={expansion.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formExpansionIds.includes(expansion.id)}
                        onChange={() => setFormExpansionIds((prev) => toggleSelection(prev, expansion.id))}
                      />
                      <span>{expansion.name}</span>
                    </label>
                  ))}
                </div>
              </div>
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
            <DialogTitle>{t('deleteTheme')}</DialogTitle>
            <DialogDescription>
              {t('confirmDelete', { name: selectedTheme?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          {selectedTheme && (selectedTheme._count.games > 0 || selectedTheme._count.expansions > 0) && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              {`Cannot delete this theme because it is linked to ${selectedTheme._count.games} games and ${selectedTheme._count.expansions} expansions.`}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isLoading ||
                (selectedTheme?._count.games ?? 0) > 0 ||
                (selectedTheme?._count.expansions ?? 0) > 0
              }
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
