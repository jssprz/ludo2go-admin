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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ExternalLink,
  Download,
  CopyPlus,
} from 'lucide-react';
import { GuideStatus } from '@prisma/client';

type GuideCategory = {
  id: string;
  slug: string;
  name: string;
};

type Guide = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  status: GuideStatus;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string | null;
  category: GuideCategory | null;
  _count: {
    blocks: number;
    variants: number;
  };
};

type Props = {
  initialGuides: Guide[];
  categories: GuideCategory[];
};

export function GuidesTable({ initialGuides, categories }: Props) {
  const router = useRouter();
  const t = useTranslations('guides');
  const tc = useTranslations('common');
  const [guides, setGuides] = useState<Guide[]>(initialGuides);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GuideStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [activeGuideAction, setActiveGuideAction] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formStatus, setFormStatus] = useState<GuideStatus>(GuideStatus.draft);
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredGuides = guides.filter((guide) => {
    const matchesSearch =
      guide.title.toLowerCase().includes(search.toLowerCase()) ||
      guide.slug.toLowerCase().includes(search.toLowerCase()) ||
      (guide.excerpt && guide.excerpt.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || guide.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || guide.categoryId === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleTitleChange(title: string) {
    setFormTitle(title);
    // Auto-generate slug if creating new or slug is empty
    if (!selectedGuide || !formSlug) {
      setFormSlug(generateSlug(title));
    }
  }

  function resetForm() {
    setFormTitle('');
    setFormSlug('');
    setFormSubtitle('');
    setFormExcerpt('');
    setFormStatus(GuideStatus.draft);
    setFormCategoryId('');
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedGuide(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(guide: Guide) {
    setSelectedGuide(guide);
    setFormTitle(guide.title);
    setFormSlug(guide.slug);
    setFormSubtitle(guide.subtitle || '');
    setFormExcerpt(guide.excerpt || '');
    setFormStatus(guide.status);
    setFormCategoryId(guide.categoryId || '');
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(guide: Guide) {
    setSelectedGuide(guide);
    setShowDeleteDialog(true);
  }

  function getStatusBadgeVariant(status: GuideStatus) {
    switch (status) {
      case GuideStatus.published:
        return 'default';
      case GuideStatus.draft:
        return 'secondary';
      case GuideStatus.archived:
        return 'outline';
      default:
        return 'secondary';
    }
  }

  async function getErrorMessage(res: Response) {
    try {
      const error = await res.json();
      return error.error || tc('error');
    } catch {
      return tc('error');
    }
  }

  function getFileNameFromHeader(contentDisposition: string | null) {
    if (!contentDisposition) return null;

    const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
    return match?.[1] ?? null;
  }

  function isGuideActionLoading(guideId: string, action: 'export' | 'duplicate') {
    return activeGuideAction === `${action}:${guideId}`;
  }

  async function handleCreate() {
    if (!formTitle.trim() || !formSlug.trim()) {
      setFormError(tc('required'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          slug: formSlug.trim(),
          subtitle: formSubtitle.trim() || null,
          excerpt: formExcerpt.trim() || null,
          status: formStatus,
          categoryId: formCategoryId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || tc('error'));
      }

      const newGuide = await res.json();
      setGuides([newGuide, ...guides]);
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedGuide || !formTitle.trim() || !formSlug.trim()) {
      setFormError(tc('required'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/guides/${selectedGuide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          slug: formSlug.trim(),
          subtitle: formSubtitle.trim() || null,
          excerpt: formExcerpt.trim() || null,
          status: formStatus,
          categoryId: formCategoryId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || tc('error'));
      }

      const updatedGuide = await res.json();
      setGuides(guides.map(g => g.id === selectedGuide.id ? updatedGuide : g));
      setShowEditDialog(false);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedGuide) return;

    setIsLoading(true);

    try {
      const res = await fetch(`/api/guides/${selectedGuide.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || tc('error'));
      }

      setGuides(guides.filter(g => g.id !== selectedGuide.id));
      setShowDeleteDialog(false);
      setSelectedGuide(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport(guide: Guide) {
    setActiveGuideAction(`export:${guide.id}`);
    setTableError(null);

    try {
      const res = await fetch(`/api/guides/${guide.id}/export`);
      if (!res.ok) {
        throw new Error(await getErrorMessage(res));
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const fileName = getFileNameFromHeader(res.headers.get('content-disposition')) || `${guide.slug}.json`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setTableError(error instanceof Error ? error.message : tc('error'));
    } finally {
      setActiveGuideAction(null);
    }
  }

  async function handleDuplicate(guide: Guide) {
    setActiveGuideAction(`duplicate:${guide.id}`);
    setTableError(null);

    try {
      const res = await fetch(`/api/guides/${guide.id}/duplicate`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res));
      }

      const duplicatedGuide = await res.json();
      setGuides((prev) => [duplicatedGuide, ...prev]);
      router.push(`/guides/${duplicatedGuide.id}`);
    } catch (error) {
      setTableError(error instanceof Error ? error.message : tc('error'));
    } finally {
      setActiveGuideAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('guides')}</CardTitle>
          <CardDescription>
            {t('manageGuides')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tc('search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: GuideStatus | 'all') => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatuses')}</SelectItem>
                  <SelectItem value={GuideStatus.draft}>{t('draft')}</SelectItem>
                  <SelectItem value={GuideStatus.published}>{t('published')}</SelectItem>
                  <SelectItem value={GuideStatus.archived}>{t('archived')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allCategories')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {tc('create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {tableError && (
            <div className="px-4 pt-4 text-sm text-destructive">{tableError}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('title')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead>{t('blocks')}</TableHead>
                <TableHead>{t('variants')}</TableHead>
                <TableHead>{t('updated')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGuides.map((guide) => (
                <TableRow key={guide.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{guide.title}</div>
                      {guide.subtitle && (
                        <div className="text-sm text-muted-foreground">{guide.subtitle}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(guide.status)}>
                      {t(guide.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{guide.category?.name || '-'}</TableCell>
                  <TableCell>{guide._count.blocks}</TableCell>
                  <TableCell>{guide._count.variants}</TableCell>
                  <TableCell>{new Date(guide.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/guides/${guide.id}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t('view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(guide)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExport(guide)}
                          disabled={activeGuideAction !== null}
                        >
                          {isGuideActionLoading(guide.id, 'export') ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          {t('exportJson')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(guide)}
                          disabled={activeGuideAction !== null}
                        >
                          {isGuideActionLoading(guide.id, 'duplicate') ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CopyPlus className="h-4 w-4 mr-2" />
                          )}
                          {t('duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(guide)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('createGuide')}</DialogTitle>
            <DialogDescription>
              {t('createGuideDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-title">{t('title')} *</Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="create-slug">{t('slug')} *</Label>
              <Input
                id="create-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder={t('slugPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="create-subtitle">{t('subtitle')}</Label>
              <Input
                id="create-subtitle"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder={t('subtitlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="create-excerpt">{t('excerpt')}</Label>
              <Input
                id="create-excerpt"
                value={formExcerpt}
                onChange={(e) => setFormExcerpt(e.target.value)}
                placeholder={t('excerptPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-status">{t('status')}</Label>
                <Select value={formStatus} onValueChange={(value: GuideStatus) => setFormStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GuideStatus.draft}>{t('draft')}</SelectItem>
                    <SelectItem value={GuideStatus.published}>{t('published')}</SelectItem>
                    <SelectItem value={GuideStatus.archived}>{t('archived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create-category">{t('category')}</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editGuide')}</DialogTitle>
            <DialogDescription>
              {t('editGuideDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">{t('title')} *</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="edit-slug">{t('slug')} *</Label>
              <Input
                id="edit-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder={t('slugPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="edit-subtitle">{t('subtitle')}</Label>
              <Input
                id="edit-subtitle"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder={t('subtitlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="edit-excerpt">{t('excerpt')}</Label>
              <Input
                id="edit-excerpt"
                value={formExcerpt}
                onChange={(e) => setFormExcerpt(e.target.value)}
                placeholder={t('excerptPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-status">{t('status')}</Label>
                <Select value={formStatus} onValueChange={(value: GuideStatus) => setFormStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GuideStatus.draft}>{t('draft')}</SelectItem>
                    <SelectItem value={GuideStatus.published}>{t('published')}</SelectItem>
                    <SelectItem value={GuideStatus.archived}>{t('archived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-category">{t('category')}</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <DialogTitle>{t('deleteGuide')}</DialogTitle>
            <DialogDescription>
              {t('deleteGuideDescription')}
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