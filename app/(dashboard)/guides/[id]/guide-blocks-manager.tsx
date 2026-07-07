'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GuideBlockType } from '@prisma/client';

type GuideBlock = {
  id: string;
  guideId: string;
  type: GuideBlockType;
  sortOrder: number;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  data: any;
};

type Guide = {
  id: string;
  title: string;
  blocks: GuideBlock[];
};

type Props = {
  guide: Guide;
};

interface SortableItemProps {
  block: GuideBlock;
  onEdit: (block: GuideBlock) => void;
  onDelete: (block: GuideBlock) => void;
  getBlockTypeLabel: (type: GuideBlockType) => string;
  t: any;
}

function SortableItem({ block, onEdit, onDelete, getBlockTypeLabel, t }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 flex items-start gap-4">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
            </div>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <div className="font-medium truncate">{block.title || getBlockTypeLabel(block.type)}</div>
              <div className="text-sm text-muted-foreground truncate">
                {getBlockTypeLabel(block.type)} • {t('order')}: {block.sortOrder + 1}
              </div>
              {block.body ? (
                <div
                  className="text-sm mt-2 line-clamp-2 max-w-full overflow-hidden prose prose-sm dark:prose-invert text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: block.body }}
                />
              ) : block.data ? (
                <pre className="text-xs mt-2 line-clamp-2 max-w-full overflow-hidden text-muted-foreground">
                  {JSON.stringify(block.data, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(block)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(block)} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GuideBlocksManager({ guide }: Props) {
  const t = useTranslations('guides');
  const tc = useTranslations('common');
  const [blocks, setBlocks] = useState<GuideBlock[]>(guide.blocks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<GuideBlock | null>(null);

  // Form states
  const [formType, setFormType] = useState<GuideBlockType>(GuideBlockType.rich_text);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageAlt, setFormImageAlt] = useState('');
  const [formButtonText, setFormButtonText] = useState('');
  const [formButtonUrl, setFormButtonUrl] = useState('');
  const [formDataJson, setFormDataJson] = useState('{}');
  const [formError, setFormError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function resetForm() {
    setFormType(GuideBlockType.rich_text);
    setFormTitle('');
    setFormBody('');
    setFormImageUrl('');
    setFormImageAlt('');
    setFormButtonText('');
    setFormButtonUrl('');
    setFormDataJson('{}');
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedBlock(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(block: GuideBlock) {
    setSelectedBlock(block);
    setFormType(block.type);
    setFormTitle(block.title || '');
    setFormBody(block.body || '');
    setFormImageUrl(block.imageUrl || '');
    setFormImageAlt(block.imageAlt || '');
    setFormButtonText(block.buttonText || '');
    setFormButtonUrl(block.buttonUrl || '');
    setFormDataJson(JSON.stringify(block.data || {}, null, 2));
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(block: GuideBlock) {
    setSelectedBlock(block);
    setShowDeleteDialog(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update sortOrder for all items
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          sortOrder: index,
        }));

        // Update sort orders on the server
        updateSortOrders(updatedItems);

        return updatedItems;
      });
    }
  }

  async function updateSortOrders(updatedBlocks: GuideBlock[]) {
    try {
      const updates = updatedBlocks.map((block, index) => ({
        id: block.id,
        sortOrder: index,
      }));

      const res = await fetch(`/api/guide-blocks/sort`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        throw new Error('Failed to update sort orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder blocks');
    }
  }

  async function handleCreate() {
    if (!formType) {
      setFormError(tc('required'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    let parsedData: any = {};
    try {
      parsedData = formDataJson.trim() ? JSON.parse(formDataJson) : {};
    } catch (jsonError) {
      setFormError('Invalid JSON in data field.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/guide-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guideId: guide.id,
          type: formType,
          sortOrder: blocks.length,
          title: formTitle.trim() || null,
          body: formBody.trim() || null,
          imageUrl: formImageUrl.trim() || null,
          imageAlt: formImageAlt.trim() || null,
          buttonText: formButtonText.trim() || null,
          buttonUrl: formButtonUrl.trim() || null,
          data: parsedData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      const newBlock = await res.json();
      setBlocks([...blocks, newBlock]);
      setShowCreateDialog(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedBlock || !formType) {
      setFormError(tc('required'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    let parsedData: any = {};
    try {
      parsedData = formDataJson.trim() ? JSON.parse(formDataJson) : {};
    } catch (jsonError) {
      setFormError('Invalid JSON in data field.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/guide-blocks/${selectedBlock.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          title: formTitle.trim() || null,
          body: formBody.trim() || null,
          imageUrl: formImageUrl.trim() || null,
          imageAlt: formImageAlt.trim() || null,
          buttonText: formButtonText.trim() || null,
          buttonUrl: formButtonUrl.trim() || null,
          data: parsedData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      const updatedBlock = await res.json();
      setBlocks(blocks.map((b) => (b.id === selectedBlock.id ? updatedBlock : b)));
      setShowEditDialog(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedBlock) return;

    setIsLoading(true);

    try {
      const res = await fetch(`/api/guide-blocks/${selectedBlock.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      setBlocks(blocks.filter((b) => b.id !== selectedBlock.id));
      setShowDeleteDialog(false);
      setSelectedBlock(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  function getBlockTypeLabel(type: GuideBlockType): string {
    switch (type) {
      case GuideBlockType.rich_text:
        return t('blockTypeRichText');
      case GuideBlockType.heading:
        return t('blockTypeHeading');
      case GuideBlockType.hero:
        return t('blockTypeHero');
      case GuideBlockType.intro:
        return t('blockTypeIntro');
      case GuideBlockType.image:
        return t('blockTypeImage');
      case GuideBlockType.criteria:
        return t('blockTypeCriteria');
      case GuideBlockType.quote:
        return t('blockTypeQuote');
      case GuideBlockType.faq:
        return t('blockTypeFaq');
      case GuideBlockType.product_list:
        return t('blockTypeProductList');
      case GuideBlockType.product_recommendation:
        return t('blockTypeProductRecommendation');
      case GuideBlockType.comparison:
        return t('blockTypeComparison');
      case GuideBlockType.product_grid:
        return t('blockTypeProductGrid');
      case GuideBlockType.cta:
        return t('blockTypeCta');
      case GuideBlockType.final_cta:
        return t('blockTypeFinalCta');
      default:
        return type;
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('guideBlocks')}</CardTitle>
          <CardDescription>
            {t('guideBlocksDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addBlock')}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {blocks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {t('noBlocks')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block) => (
                <SortableItem
                  key={block.id}
                  block={block}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  getBlockTypeLabel={getBlockTypeLabel}
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('addBlock')}</DialogTitle>
            <DialogDescription>
              {t('addBlockDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-type">{t('blockType')} *</Label>
              <Select value={formType} onValueChange={(value: GuideBlockType) => setFormType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GuideBlockType.rich_text}>{t('blockTypeRichText')}</SelectItem>
                  <SelectItem value={GuideBlockType.heading}>{t('blockTypeHeading')}</SelectItem>
                  <SelectItem value={GuideBlockType.hero}>{t('blockTypeHero')}</SelectItem>
                  <SelectItem value={GuideBlockType.intro}>{t('blockTypeIntro')}</SelectItem>
                  <SelectItem value={GuideBlockType.image}>{t('blockTypeImage')}</SelectItem>
                  <SelectItem value={GuideBlockType.criteria}>{t('blockTypeCriteria')}</SelectItem>
                  <SelectItem value={GuideBlockType.quote}>{t('blockTypeQuote')}</SelectItem>
                  <SelectItem value={GuideBlockType.faq}>{t('blockTypeFaq')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_list}>{t('blockTypeProductList')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_recommendation}>{t('blockTypeProductRecommendation')}</SelectItem>
                  <SelectItem value={GuideBlockType.comparison}>{t('blockTypeComparison')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_grid}>{t('blockTypeProductGrid')}</SelectItem>
                  <SelectItem value={GuideBlockType.cta}>{t('blockTypeCta')}</SelectItem>
                  <SelectItem value={GuideBlockType.final_cta}>{t('blockTypeFinalCta')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-title">{t('title')}</Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('blockTitlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="create-body">{t('body')}</Label>
              <RichTextEditor
                value={formBody}
                onValueChange={setFormBody}
                placeholder={t('blockBodyPlaceholder')}
                className="min-h-[180px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-imageUrl">{t('imageUrl')}</Label>
                <Input
                  id="create-imageUrl"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="create-imageAlt">{t('imageAlt')}</Label>
                <Input
                  id="create-imageAlt"
                  value={formImageAlt}
                  onChange={(e) => setFormImageAlt(e.target.value)}
                  placeholder={t('imageAltPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-buttonText">{t('buttonText')}</Label>
                <Input
                  id="create-buttonText"
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-buttonUrl">{t('buttonUrl')}</Label>
                <Input
                  id="create-buttonUrl"
                  value={formButtonUrl}
                  onChange={(e) => setFormButtonUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="create-data">{t('blockDataJson')}</Label>
              <Textarea
                id="create-data"
                value={formDataJson}
                onChange={(e) => setFormDataJson(e.target.value)}
                placeholder={t('blockDataDescription')}
                rows={8}
              />
            </div>
            {formError && (
              <div className="text-sm text-destructive">{formError}</div>
            )}
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
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog key={`edit-${showEditDialog}`} open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editBlock')}</DialogTitle>
            <DialogDescription>
              {t('editBlockDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-type">{t('blockType')} *</Label>
              <Select value={formType} onValueChange={(value: GuideBlockType) => setFormType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GuideBlockType.rich_text}>{t('blockTypeRichText')}</SelectItem>
                  <SelectItem value={GuideBlockType.heading}>{t('blockTypeHeading')}</SelectItem>
                  <SelectItem value={GuideBlockType.hero}>{t('blockTypeHero')}</SelectItem>
                  <SelectItem value={GuideBlockType.intro}>{t('blockTypeIntro')}</SelectItem>
                  <SelectItem value={GuideBlockType.image}>{t('blockTypeImage')}</SelectItem>
                  <SelectItem value={GuideBlockType.criteria}>{t('blockTypeCriteria')}</SelectItem>
                  <SelectItem value={GuideBlockType.quote}>{t('blockTypeQuote')}</SelectItem>
                  <SelectItem value={GuideBlockType.faq}>{t('blockTypeFaq')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_list}>{t('blockTypeProductList')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_recommendation}>{t('blockTypeProductRecommendation')}</SelectItem>
                  <SelectItem value={GuideBlockType.comparison}>{t('blockTypeComparison')}</SelectItem>
                  <SelectItem value={GuideBlockType.product_grid}>{t('blockTypeProductGrid')}</SelectItem>
                  <SelectItem value={GuideBlockType.cta}>{t('blockTypeCta')}</SelectItem>
                  <SelectItem value={GuideBlockType.final_cta}>{t('blockTypeFinalCta')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-title">{t('title')}</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('blockTitlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="edit-body">{t('body')}</Label>
              <RichTextEditor
                value={formBody}
                onValueChange={setFormBody}
                placeholder={t('blockBodyPlaceholder')}
                className="min-h-[180px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-imageUrl">{t('imageUrl')}</Label>
                <Input
                  id="edit-imageUrl"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="edit-imageAlt">{t('imageAlt')}</Label>
                <Input
                  id="edit-imageAlt"
                  value={formImageAlt}
                  onChange={(e) => setFormImageAlt(e.target.value)}
                  placeholder={t('imageAltPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-buttonText">{t('buttonText')}</Label>
                <Input
                  id="edit-buttonText"
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-buttonUrl">{t('buttonUrl')}</Label>
                <Input
                  id="edit-buttonUrl"
                  value={formButtonUrl}
                  onChange={(e) => setFormButtonUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-data">{t('blockDataJson')}</Label>
              <Textarea
                id="edit-data"
                value={formDataJson}
                onChange={(e) => setFormDataJson(e.target.value)}
                placeholder={t('blockDataDescription')}
                rows={8}
              />
            </div>
            {formError && (
              <div className="text-sm text-destructive">{formError}</div>
            )}
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
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteBlock')}</DialogTitle>
            <DialogDescription>
              {t('deleteBlockDescription')}
            </DialogDescription>
          </DialogHeader>
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
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}