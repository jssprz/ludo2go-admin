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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type GameMechanic = {
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
  bggId: number | null;
  bggName: string | null;
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
  initialMechanics: GameMechanic[];
  availableGames: CatalogOption[];
  availableExpansions: CatalogOption[];
};

type SortableMechanicRowProps = {
  mechanic: GameMechanic;
  isBusy: boolean;
  onToggleActive: (mechanic: GameMechanic) => void;
  onOpenEdit: (mechanic: GameMechanic) => void;
  onOpenDelete: (mechanic: GameMechanic) => void;
  t: any;
  tc: any;
};

function SortableMechanicRow({
  mechanic,
  isBusy,
  onToggleActive,
  onOpenEdit,
  onOpenDelete,
  t,
  tc,
}: SortableMechanicRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mechanic.id,
    disabled: isBusy,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'opacity-60' : ''}>
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-grab rounded p-0.5 active:cursor-grabbing disabled:cursor-not-allowed"
            disabled={isBusy}
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm text-muted-foreground">{mechanic.order}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{mechanic.name}</div>
          {mechanic.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">{mechanic.description}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm text-muted-foreground">{mechanic.slug}</code>
      </TableCell>
      <TableCell>
        {mechanic.icon ? (
          <code className="text-sm">{mechanic.icon}</code>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {mechanic.bggId ? (
          <div>
            <code className="text-sm">{mechanic.bggId}</code>
            {mechanic.bggName && (
              <div className="text-xs text-muted-foreground truncate max-w-[120px]" title={mechanic.bggName}>
                {mechanic.bggName}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={mechanic._count.games > 0 ? 'default' : 'secondary'}>{mechanic._count.games}</Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={mechanic._count.expansions > 0 ? 'default' : 'secondary'}>{mechanic._count.expansions}</Badge>
      </TableCell>
      <TableCell className="text-center">
        <Button variant="ghost" size="sm" onClick={() => onToggleActive(mechanic)} disabled={isBusy}
          aria-label={mechanic.isActive ? `Desactivar ${mechanic.name}` : `Activar ${mechanic.name}`}
        >
          {mechanic.isActive ? (
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
            <Button variant="ghost" size="icon" disabled={isBusy} aria-label={`Acciones para ${mechanic.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenEdit(mechanic)}>
              <Pencil className="mr-2 h-4 w-4" />
              {tc('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenDelete(mechanic)}
              className="text-red-600"
              disabled={mechanic._count.games > 0 || mechanic._count.expansions > 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {tc('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function GameMechanicsTable({ initialMechanics, availableGames, availableExpansions }: Props) {
  const router = useRouter();
  const t = useTranslations('gameMechanics');
  const tc = useTranslations('common');
  const [mechanics, setMechanics] = useState<GameMechanic[]>(initialMechanics);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState<GameMechanic | null>(null);

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
  const [formBggId, setFormBggId] = useState<number | ''>('');
  const [formBggName, setFormBggName] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formGameIds, setFormGameIds] = useState<string[]>([]);
  const [formExpansionIds, setFormExpansionIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFetchingBggMechanic, setIsFetchingBggMechanic] = useState(false);

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

  const filteredMechanics = mechanics.filter(
    (mechanic) =>
      mechanic.name.toLowerCase().includes(search.toLowerCase()) ||
      mechanic.slug.toLowerCase().includes(search.toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isBusy = isLoading || isReordering;

  async function handleDragEnd(event: DragEndEvent) {
    if (search.trim()) return;

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const previousMechanics = mechanics;
    const oldIndex = previousMechanics.findIndex((mechanic) => mechanic.id === active.id);
    const newIndex = previousMechanics.findIndex((mechanic) => mechanic.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedMechanics = arrayMove(previousMechanics, oldIndex, newIndex).map(
      (mechanic, index) => ({
        ...mechanic,
        order: index,
      })
    );

    setMechanics(reorderedMechanics);
    setReorderError(null);
    setIsReordering(true);

    try {
      const res = await fetch('/api/game-mechanics/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: reorderedMechanics.map((mechanic) => ({
            id: mechanic.id,
            order: mechanic.order,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reorder mechanics');
      }

      router.refresh();
    } catch (error: any) {
      setMechanics(previousMechanics);
      setReorderError(error.message);
    } finally {
      setIsReordering(false);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleNameChange(name: string) {
    setFormName(name);
    if (!selectedMechanic || !formSlug) {
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
    setFormBggId('');
    setFormBggName('');
    setFormOrder(mechanics.length);
    setFormIsActive(true);
    setFormGameIds([]);
    setFormExpansionIds([]);
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedMechanic(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(mechanic: GameMechanic) {
    setSelectedMechanic(mechanic);
    setFormName(mechanic.name);
    setFormSlug(mechanic.slug);
    setFormDescription(mechanic.description || '');
    setFormTitle(mechanic.title || '');
    setFormSubtitle(mechanic.subtitle || '');
    setFormEmotional(mechanic.emotional || '');
    setFormBenefits((mechanic.benefits || []).join('\n'));
    setFormUrgency(mechanic.urgency || '');
    setFormIcon(mechanic.icon || '');
    setFormBggId(mechanic.bggId ?? '');
    setFormBggName(mechanic.bggName || '');
    setFormOrder(mechanic.order);
    setFormIsActive(mechanic.isActive);
    setFormGameIds(mechanic.games?.map((game) => game.productId) ?? []);
    setFormExpansionIds(mechanic.expansions?.map((expansion) => expansion.productId) ?? []);
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(mechanic: GameMechanic) {
    setSelectedMechanic(mechanic);
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
      const res = await fetch('/api/game-mechanics', {
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
          bggId: formBggId !== '' ? Number(formBggId) : null,
          bggName: formBggName.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          gameIds: formGameIds,
          expansionIds: formExpansionIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create mechanic');
      }

      setMechanics((prev) =>
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

  async function handleFetchMechanicFromBGG() {
    if (formBggId === '') {
      setFormError('BGG ID is required to fetch mechanic data.');
      return;
    }

    setIsFetchingBggMechanic(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/bgg/${formBggId}?entity=mechanic`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Failed to fetch mechanic from BGG');
      }

      const prefill = data?.mechanicPrefill;
      const translatedName = (prefill?.name || data?.name || '').trim();
      const translatedDescription = (prefill?.description || data?.description || '').trim();
      const sourceBggName = (prefill?.bggName || data?.name || '').trim();

      if (translatedName) {
        handleNameChange(translatedName);
      }

      if (translatedDescription) {
        setFormDescription(translatedDescription);
      }

      if (sourceBggName) {
        setFormBggName(sourceBggName);
      }

      if (typeof data?.id === 'number') {
        setFormBggId(data.id);
      }

      if (Array.isArray(data?.matchedMechanics) && data.matchedMechanics.length > 0) {
        setFormError(`A mechanic with this BGG ID already exists: ${data.matchedMechanics[0].name}.`);
      }
    } catch (error: any) {
      setFormError(error.message || 'Failed to fetch mechanic from BGG');
    } finally {
      setIsFetchingBggMechanic(false);
    }
  }

  async function handleUpdate() {
    if (!selectedMechanic) return;
    if (!formName.trim() || !formSlug.trim()) {
      setFormError(t('nameSlugRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-mechanics/${selectedMechanic.id}`, {
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
          bggId: formBggId !== '' ? Number(formBggId) : null,
          bggName: formBggName.trim() || null,
          order: formOrder,
          isActive: formIsActive,
          gameIds: formGameIds,
          expansionIds: formExpansionIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update mechanic');
      }

      setMechanics((prev) =>
        prev
          .map((m) =>
            m.id === selectedMechanic.id ? { ...data, _count: m._count } : m
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
    if (!selectedMechanic) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/game-mechanics/${selectedMechanic.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete mechanic');
      }

      setMechanics((prev) => prev.filter((m) => m.id !== selectedMechanic.id));
      setShowDeleteDialog(false);
      setSelectedMechanic(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(mechanic: GameMechanic) {
    setIsLoading(true);

    try {
      const res = await fetch(`/api/game-mechanics/${mechanic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mechanic.name,
          slug: mechanic.slug,
          description: mechanic.description,
          title: mechanic.title,
          subtitle: mechanic.subtitle,
          emotional: mechanic.emotional,
          benefits: mechanic.benefits,
          urgency: mechanic.urgency,
          icon: mechanic.icon,
          bggId: mechanic.bggId,
          bggName: mechanic.bggName,
          order: mechanic.order,
          isActive: !mechanic.isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update mechanic');
      }

      setMechanics((prev) =>
        prev.map((m) =>
          m.id === mechanic.id ? { ...m, isActive: !m.isActive } : m
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
              <CardTitle>{t('allMechanics')}</CardTitle>
              <CardDescription>
                {mechanics.length} {t('mechanicsTotal', { count: mechanics.length })}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addMechanic')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reorderError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{reorderError}</div>
          )}

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
                  <TableHead>BGG</TableHead>
                  <TableHead className="text-center">{t('games')}</TableHead>
                  <TableHead className="text-center">Expansions</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredMechanics.map((mechanic) => mechanic.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                {filteredMechanics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {search ? t('noResultsSearch') : t('noMechanics')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMechanics.map((mechanic) => (
                    <SortableMechanicRow
                      key={mechanic.id}
                      mechanic={mechanic}
                      isBusy={isBusy || Boolean(search.trim())}
                      onToggleActive={handleToggleActive}
                      onOpenEdit={openEditDialog}
                      onOpenDelete={openDeleteDialog}
                      t={t}
                      tc={tc}
                    />
                  ))
                )}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('addMechanic')}</DialogTitle>
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
                placeholder="Strategic depth, quick turns, social interaction"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-bggId">BGG ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="create-bggId"
                    type="number"
                    value={formBggId}
                    onChange={(e) => setFormBggId(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="e.g. 2040"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchMechanicFromBGG}
                    disabled={isLoading || isFetchingBggMechanic || formBggId === ''}
                  >
                    {(isLoading || isFetchingBggMechanic) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Fetch
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-bggName">BGG Name</Label>
                <Input
                  id="create-bggName"
                  value={formBggName}
                  onChange={(e) => setFormBggName(e.target.value)}
                  placeholder="e.g. Hand Management"
                />
              </div>
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
              <Label htmlFor="create-active">{t('activeMechanic')}</Label>
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
              {t('createMechanic')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editMechanic')}</DialogTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-bggId">BGG ID</Label>
                <Input
                  id="edit-bggId"
                  type="number"
                  value={formBggId}
                  onChange={(e) => setFormBggId(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g. 2040"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bggName">BGG Name</Label>
                <Input
                  id="edit-bggName"
                  value={formBggName}
                  onChange={(e) => setFormBggName(e.target.value)}
                  placeholder="e.g. Hand Management"
                />
              </div>
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
              <Label htmlFor="edit-active">{t('activeMechanic')}</Label>
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
            <DialogTitle>{t('deleteMechanic')}</DialogTitle>
            <DialogDescription>
              {t('confirmDelete', { name: selectedMechanic?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          {selectedMechanic && (selectedMechanic._count.games > 0 || selectedMechanic._count.expansions > 0) && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              {`Cannot delete this mechanic because it is linked to ${selectedMechanic._count.games} games and ${selectedMechanic._count.expansions} expansions.`}
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
                (selectedMechanic?._count.games ?? 0) > 0 ||
                (selectedMechanic?._count.expansions ?? 0) > 0
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
