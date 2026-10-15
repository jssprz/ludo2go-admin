'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ClipboardCheck,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { loadGuideCatalogSlugs } from '@/lib/guide-catalog';
import { checkGuidePublication, type GuidePublicationIssue } from '@/lib/guide-checklist';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  blockDefinitions,
  blockAnchor,
  blockSummary,
  getProductSlugs,
  guideBlockSchema,
  guideBlockTypes,
  type GuideBlockType
} from '@/lib/guide-blocks';
import {
  GuideBlockFields,
  readField,
  writeField,
  type FieldIssues
} from './guide-block-fields';

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
  data: unknown;
};
type Guide = {
  id: string;
  title: string;
  blocks: GuideBlock[];
  intro?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  variants?: { variant: { product: { slug: string; name?: string } } }[];
};
type Draft = Record<string, unknown> & {
  type: GuideBlockType;
  data: Record<string, unknown>;
};
type Editor = {
  id: string | null;
  baseline: string;
  draft: Draft;
  json: string;
  advanced: boolean;
};

function draftFor(block?: GuideBlock): Draft {
  return {
    type: block?.type ?? 'rich_text',
    title: block?.title ?? '',
    body: block?.body ?? '',
    imageUrl: block?.imageUrl ?? '',
    imageAlt: block?.imageAlt ?? '',
    buttonText: block?.buttonText ?? '',
    buttonUrl: block?.buttonUrl ?? '',
    data:
      block?.data &&
      typeof block.data === 'object' &&
      !Array.isArray(block.data)
        ? (structuredClone(block.data) as Record<string, unknown>)
        : structuredClone(
            blockDefinitions[block?.type ?? 'rich_text'].defaultData
          )
  };
}

function convertType(draft: Draft, type: GuideBlockType): Draft {
  const candidate = { ...draft, type };
  if (guideBlockSchema.safeParse(candidate).success) return candidate;
  let next: Draft = {
    ...draft,
    type,
    data: structuredClone(blockDefinitions[type].defaultData)
  };
  for (const field of blockDefinitions[type].fields) {
    if (!field.path.startsWith('data.')) continue;
    const previous = readField(draft, field.path);
    if (
      typeof previous === 'string' &&
      !['products', 'items', 'strings'].includes(field.kind)
    )
      next = writeField(next, field.path, previous) as Draft;
  }
  const commonTitle = draft.title || draft.data.title;
  const commonBody =
    draft.body ||
    draft.data.content ||
    draft.data.description ||
    draft.data.summary;
  for (const field of blockDefinitions[type].fields) {
    const content = /(^|\.)title$/.test(field.path)
      ? commonTitle
      : ['body', 'data.content', 'data.description', 'data.summary'].includes(
            field.path
          )
        ? commonBody
        : undefined;
    if (!readField(next, field.path) && typeof content === 'string')
      next = writeField(next, field.path, content) as Draft;
  }
  return next;
}

function IconButton({
  label,
  children,
  onClick,
  disabled
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function SortableBlock({
  block,
  busy,
  collapsed,
  toggle,
  edit,
  duplicate,
  remove
}: {
  block: GuideBlock;
  busy: boolean;
  collapsed: boolean;
  toggle: () => void;
  edit: () => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const sortable = useSortable({ id: block.id, disabled: busy });
  return (
    <article
      id={blockAnchor(block.id)}
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition
      }}
      className={`min-w-0 rounded-md border bg-card p-3 ${sortable.isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reorder ${blockDefinitions[block.type].label}`}
          title="Drag to reorder"
          disabled={busy}
          className="shrink-0 touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-medium">
            {block.title || blockDefinitions[block.type].label}
          </h3>
          <p className="text-xs text-muted-foreground">
            {blockDefinitions[block.type].label} · {block.sortOrder + 1}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <IconButton
            label={collapsed ? 'Expand block' : 'Collapse block'}
            onClick={toggle}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </IconButton>
          <IconButton label="Edit block" onClick={edit} disabled={busy}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Duplicate block"
            onClick={duplicate}
            disabled={busy}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete block" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      {!collapsed && (
        <div className="mt-2 space-y-1 pl-12">
          <p className="break-words text-sm text-muted-foreground">
            {blockSummary(block)}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            #{blockAnchor(block.id)}
          </p>
        </div>
      )}
    </article>
  );
}

export function GuideBlocksManager({ guide }: { guide: Guide }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(() =>
    [...guide.blocks].sort((left, right) => left.sortOrder - right.sortOrder)
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [issues, setIssues] = useState<FieldIssues>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const requestGuard = useRef(false);
  const uploadGuard = useRef(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [checklist, setChecklist] = useState<GuidePublicationIssue[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState<GuideBlock | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingLeave, setPendingLeave] = useState<{ href?: string } | null>(
    null
  );
  const dirty = Boolean(
    editor &&
      (editor.baseline === '' ||
        JSON.stringify(editor.draft) !== editor.baseline ||
        editor.json !== JSON.stringify(editor.draft.data, null, 2))
  );
  const protect = useRef(false);
  protect.current = (dirty || uploadingImage) && !busy;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!requestGuard.current)
      setBlocks(
        [...guide.blocks].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
  }, [guide.blocks]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!protect.current || requestGuard.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const navigation = (event: MouseEvent) => {
      if (
        !protect.current ||
        requestGuard.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? (event.target.closest('a[href]') as HTMLAnchorElement | null)
          : null;
      if (
        !target ||
        target.target === '_blank' ||
        target.hasAttribute('download')
      )
        return;
      const url = new URL(target.href, location.href);
      if (url.origin !== location.origin || url.href === location.href) return;
      event.preventDefault();
      event.stopPropagation();
      if (uploadGuard.current) {
        setError('Wait for the image upload to finish before leaving.');
        return;
      }
      setPendingLeave({ href: `${url.pathname}${url.search}${url.hash}` });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', navigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', navigation, true);
    };
  }, []);

  function open(block?: GuideBlock, clone = false) {
    if (requestGuard.current) return;
    const draft = draftFor(block);
    setEditor({
      id: clone ? null : (block?.id ?? null),
      draft,
      baseline: clone ? '' : JSON.stringify(draft),
      json: JSON.stringify(draft.data, null, 2),
      advanced: false
    });
    setIssues({});
    setError('');
    setStatus(clone ? 'Duplicate draft' : '');
  }

  function updateDraft(next: Draft) {
    if (!editor || requestGuard.current) return;
    try {
      const data: unknown = JSON.parse(editor.json);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    } catch {
      return;
    }
    setEditor({
      ...editor,
      draft: next,
      json: JSON.stringify(next.data, null, 2)
    });
    setIssues({});
    setError('');
    setStatus('');
  }

  function closeEditor() {
    if (requestGuard.current || uploadGuard.current) return;
    if (dirty) setPendingLeave({});
    else setEditor(null);
  }

  async function responseBody(response: Response) {
    const payload = await response.json();
    if (!response.ok) {
      if (Array.isArray(payload.issues))
        setIssues(
          Object.fromEntries(
            payload.issues.map(
              (issue: {
                path: string | (string | number)[];
                message: string;
              }) => [
                Array.isArray(issue.path) ? issue.path.join('.') : issue.path,
                issue.message
              ]
            )
          )
        );
      throw new Error(payload.error || payload.message || 'Request failed');
    }
    return payload;
  }

  async function save() {
    if (requestGuard.current || uploadGuard.current || !editor) return;
    setError('');
    setIssues({});
    let data: unknown;
    try {
      data = JSON.parse(editor.json);
    } catch {
      setIssues({ data: 'Invalid JSON. Correct it before saving.' });
      return;
    }
    const parsed = guideBlockSchema.safeParse({
      ...editor.draft,
      data,
      guideId: guide.id
    });
    if (!parsed.success) {
      setIssues(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message
          ])
        )
      );
      setError('Check the highlighted fields.');
      return;
    }
    requestGuard.current = true;
    protect.current = false;
    setBusy(true);
    setStatus('Saving...');
    try {
      const returned: GuideBlock = await responseBody(
        await fetch(
          editor.id ? `/api/guide-blocks/${editor.id}` : '/api/guide-blocks',
          {
            method: editor.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data)
          }
        )
      );
      setBlocks((current) =>
        (editor.id
          ? current.map((block) =>
              block.id === returned.id ? returned : block
            )
          : [...current, returned]
        ).sort((left, right) => left.sortOrder - right.sortOrder)
      );
      const draft = draftFor(returned);
      setEditor({
        id: returned.id,
        draft,
        baseline: JSON.stringify(draft),
        json: JSON.stringify(draft.data, null, 2),
        advanced: editor.advanced
      });
      setStatus('Block saved.');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Save failed');
      setStatus('');
    } finally {
      requestGuard.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (requestGuard.current || !deleting) return;
    requestGuard.current = true;
    setBusy(true);
    setError('');
    setStatus('Deleting...');
    try {
      await responseBody(
        await fetch(`/api/guide-blocks/${deleting.id}`, { method: 'DELETE' })
      );
      setBlocks((current) =>
        current
          .filter((block) => block.id !== deleting.id)
          .map((block, sortOrder) => ({ ...block, sortOrder }))
      );
      setDeleting(null);
      setStatus('Block deleted.');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Delete failed');
      setStatus('');
    } finally {
      requestGuard.current = false;
      setBusy(false);
    }
  }

  async function reorder({ active, over }: DragEndEvent) {
    if (requestGuard.current || !over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = blocks;
    const next = arrayMove(blocks, oldIndex, newIndex).map(
      (block, sortOrder) => ({ ...block, sortOrder })
    );
    requestGuard.current = true;
    setBusy(true);
    setError('');
    setStatus('Reordering...');
    setBlocks(next);
    try {
      await responseBody(
        await fetch('/api/guide-blocks/sort', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: next.map(({ id, sortOrder }) => ({ id, sortOrder }))
          })
        })
      );
      setStatus('Order saved.');
      router.refresh();
    } catch (failure) {
      setBlocks(previous);
      setError(failure instanceof Error ? failure.message : 'Reorder failed');
      setStatus('');
    } finally {
      requestGuard.current = false;
      setBusy(false);
    }
  }

  const referenced = new Set(
    blocks.flatMap((block) => getProductSlugs(block.data))
  );
  const checklistBlocks = editor ? (() => {
    const draft = { ...editor.draft, id: editor.id ?? '00000000-0000-4000-8000-000000000000', guideId: guide.id, sortOrder: blocks.length } as GuideBlock;
    return editor.id ? blocks.map((block) => block.id === editor.id ? { ...block, ...draft, sortOrder: block.sortOrder } : block) : [...blocks, draft];
  })() : blocks;
  const checklistGuide = { ...guide, blocks: checklistBlocks };
  async function runChecklist() {
    setChecking(true);
    try {
      const catalogSlugs = await loadGuideCatalogSlugs(checklistBlocks.flatMap((block) => getProductSlugs(block.data)));
      setChecklist(checkGuidePublication(checklistGuide, { catalogSlugs }));
    } catch {
      setChecklist([...checkGuidePublication(checklistGuide), { path: 'products', message: 'Catalog validation unavailable. Try again before publishing.' }]);
    } finally { setChecking(false); }
  }
  const unused = Array.from(
    new Set(
      (guide.variants ?? [])
        .map(({ variant }) => variant.product.slug)
        .filter((slug) => !referenced.has(slug))
    )
  );
  let jsonError = '';
  if (editor) {
    try {
      const parsed: unknown = JSON.parse(editor.json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        jsonError = 'Data must be a JSON object.';
    } catch {
      jsonError = 'Invalid JSON. Correct it before saving.';
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Blocks ({blocks.length})</h2>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={checking} onClick={runChecklist}><ClipboardCheck className="mr-2 h-4 w-4" />Publication check</Button>
        <Button onClick={() => open()} disabled={busy}>
          <Plus className="mr-2 h-4 w-4" />
          Add block
        </Button>
        </div>
      </div>
      {checklist !== null && <section aria-label="Publication checklist" aria-live="polite" className="border-b pb-4">
        {checklist.length ? <ul className="space-y-1 text-sm">{checklist.map((issue, index) => <li key={index}><strong>{issue.path}</strong>: {issue.message}</li>)}</ul> : <p className="text-sm">Publication checks passed.</p>}
      </section>}
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
      {error && !editor && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {unused.length > 0 && (
        <p className="break-words text-sm text-amber-700">
          Inherited product associations not referenced by blocks:{' '}
          {unused.join(', ')}
        </p>
      )}
      {!blocks.length && (
        <p className="py-6 text-sm text-muted-foreground">No blocks yet.</p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={reorder}
      >
        <SortableContext
          items={blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                busy={busy}
                collapsed={collapsed.has(block.id)}
                toggle={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(block.id)) next.delete(block.id);
                    else next.add(block.id);
                    return next;
                  })
                }
                edit={() => open(block)}
                duplicate={() => open(block, true)}
                remove={() => {
                  setError('');
                  setDeleting(block);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] max-w-3xl overflow-y-auto"
          onEscapeKeyDown={(event) => {
            if (busy || uploadingImage) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy || uploadingImage) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editor?.id ? 'Edit block' : 'Create block'}
            </DialogTitle>
            <DialogDescription>
              {editor?.id
                ? `Anchor: #${blockAnchor(editor.id)}`
                : 'A stable anchor is assigned after saving.'}
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
              className="min-w-0 space-y-5"
            >
              <p role="status" aria-live="polite" className="text-sm">
                {uploadingImage ? 'Uploading image...' : busy
                  ? 'Saving...'
                  : dirty
                    ? 'Unsaved changes'
                    : status === 'Block saved.'
                      ? status
                      : 'No unsaved changes'}
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <fieldset disabled={busy || uploadingImage} className="min-w-0 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="block-type">Block type</Label>
                  <Select
                    value={editor.draft.type}
                    disabled={busy}
                    onValueChange={(type) =>
                      updateDraft(
                        convertType(editor.draft, type as GuideBlockType)
                      )
                    }
                  >
                    <SelectTrigger id="block-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {guideBlockTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {blockDefinitions[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <GuideBlockFields
                  key={`${editor.id ?? 'new'}-${editor.draft.type}`}
                  fields={blockDefinitions[editor.draft.type].fields}
                  value={editor.draft}
                  issues={issues}
                  onChange={(next) => updateDraft(next as Draft)}
                  onUploadingChange={(uploading) => {
                    uploadGuard.current = uploading;
                    setUploadingImage(uploading);
                  }}
                />
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editor.advanced}
                      onChange={(event) =>
                        setEditor({ ...editor, advanced: event.target.checked })
                      }
                    />
                    Advanced JSON
                  </label>
                  {editor.advanced && (
                    <>
                      <Label htmlFor="block-data">Structured data</Label>
                      <Textarea
                        id="block-data"
                        rows={12}
                        className="font-mono text-sm"
                        value={editor.json}
                        aria-invalid={Boolean(jsonError || issues.data)}
                        aria-describedby="block-data-error"
                        onChange={(event) => {
                          const json = event.target.value;
                          let draft = editor.draft;
                          try {
                            const data: unknown = JSON.parse(json);
                            if (
                              data &&
                              typeof data === 'object' &&
                              !Array.isArray(data)
                            )
                              draft = {
                                ...draft,
                                data: data as Record<string, unknown>
                              };
                          } catch {}
                          setEditor({ ...editor, json, draft });
                          setStatus('');
                          setError('');
                          setIssues({});
                        }}
                      />
                    </>
                  )}
                  {(jsonError || issues.data) && (
                    <p
                      id="block-data-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {jsonError || issues.data}
                    </p>
                  )}
                </div>
                {Object.entries(issues).length > 0 && (
                  <ul
                    aria-live="polite"
                    className="space-y-1 text-sm text-destructive"
                  >
                    {Object.entries(issues).map(([path, message]) => (
                      <li key={path}>
                        {path}: {message}
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditor}
                  disabled={busy || uploadingImage}
                >
                  Close
                </Button>
                <Button type="submit" disabled={busy || uploadingImage || Boolean(jsonError)}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save block
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !requestGuard.current) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete block?</DialogTitle>
            <DialogDescription>
              {deleting ? blockSummary(deleting) : ''}
            </DialogDescription>
          </DialogHeader>
          <p role="status" aria-live="polite">
            {busy ? 'Deleting...' : ''}
          </p>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingLeave)}
        onOpenChange={(open) => {
          if (!open) setPendingLeave(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              Your unsaved block changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLeave(null)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const href = pendingLeave?.href;
                protect.current = false;
                setPendingLeave(null);
                setEditor(null);
                if (href) router.push(href);
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
