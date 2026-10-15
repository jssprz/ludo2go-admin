'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2 } from 'lucide-react';
import { GuideStatus } from '@prisma/client';

type Guide = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  status: GuideStatus;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  intro: string | null;
  content: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  authorName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
  categoryId: string | null;
  tags: string[];
  targetKeyword: string | null;
  searchIntent: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type GuideCategory = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  guide: Guide;
  categories: GuideCategory[];
};

export function GuideEditor({ guide, categories }: Props) {
  const router = useRouter();
  const t = useTranslations('guides');
  const tc = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | 'back' | null>(null);

  const [formData, setFormData] = useState({
    title: guide.title,
    slug: guide.slug,
    subtitle: guide.subtitle || '',
    excerpt: guide.excerpt || '',
    status: guide.status,
    categoryId: guide.categoryId || '',
    coverImageUrl: guide.coverImageUrl || '',
    coverImageAlt: guide.coverImageAlt || '',
    intro: guide.intro || '',
    content: guide.content || '',
    authorName: guide.authorName || '',
    seoTitle: guide.seoTitle || '',
    seoDescription: guide.seoDescription || '',
    ogImageUrl: guide.ogImageUrl || '',
    noindex: guide.noindex,
    tags: guide.tags.join(', '),
    targetKeyword: guide.targetKeyword || '',
    searchIntent: guide.searchIntent || '',
  });
  const formDataRef = useRef(formData);
  const [baseline, setBaseline] = useState(() => JSON.stringify(formData));
  const baselineRef = useRef(baseline);
  const isDirty = JSON.stringify(formData) !== baseline;
  const unsavedLabel = t.has('unsavedChanges') ? t('unsavedChanges') : 'Unsaved changes';
  const leaveDescription = t.has('leaveWithoutSavingDescription')
    ? t('leaveWithoutSavingDescription')
    : 'Your metadata changes have not been saved. Leave without saving?';
  const leaveLabel = t.has('leaveWithoutSaving') ? t('leaveWithoutSaving') : 'Leave without saving';

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function handleLinkClick(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') ||
          (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin ||
          (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  function handleInputChange(
    field: keyof typeof formData,
    value: string | boolean
  ) {
    const next = {
      ...formDataRef.current,
      [field]: value,
    };
    formDataRef.current = next;
    dirtyRef.current = JSON.stringify(next) !== baselineRef.current;
    setFormData(next);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    const formData = formDataRef.current;
    if (!formData.title.trim() || !formData.slug.trim()) {
      setError(`${t('title')} / ${t('slug')}: ${tc('required')}`);
      setSuccess(false);
      return;
    }
    savingRef.current = true;
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/guides/${guide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          subtitle: formData.subtitle.trim() || null,
          excerpt: formData.excerpt.trim() || null,
          status: formData.status,
          categoryId: formData.categoryId || null,
          coverImageUrl: formData.coverImageUrl.trim() || null,
          coverImageAlt: formData.coverImageAlt.trim() || null,
          intro: formData.intro.trim() || null,
          content: formData.content.trim() || null,
          authorName: formData.authorName.trim() || null,
          seoTitle: formData.seoTitle.trim() || null,
          seoDescription: formData.seoDescription.trim() || null,
          ogImageUrl: formData.ogImageUrl.trim() || null,
          noindex: formData.noindex,
          tags: formData.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
          targetKeyword: formData.targetKeyword.trim() || null,
          searchIntent: formData.searchIntent.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      const savedBaseline = JSON.stringify(formData);
      baselineRef.current = savedBaseline;
      dirtyRef.current = JSON.stringify(formDataRef.current) !== savedBaseline;
      setBaseline(savedBaseline);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
    } finally {
      savingRef.current = false;
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isLoading}>
      {isDirty && <p role="status" className="text-sm text-amber-700">{unsavedLabel}</p>}
      <Card>
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
          <CardDescription>
            {t('basicInfoDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">{t('title')} *</Label>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="slug">{t('slug')} *</Label>
              <Input
                id="slug"
                required
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                placeholder={t('slugPlaceholder')}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="subtitle">{t('subtitle')}</Label>
            <Input
              id="subtitle"
              value={formData.subtitle}
              onChange={(e) => handleInputChange('subtitle', e.target.value)}
              placeholder={t('subtitlePlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="excerpt">{t('excerpt')}</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => handleInputChange('excerpt', e.target.value)}
              placeholder={t('excerptPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">{t('status')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
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
              <Label htmlFor="category">{t('category')}</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => handleInputChange('categoryId', value)}
              >
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('content')}</CardTitle>
          <CardDescription>
            {t('contentDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="intro">{t('intro')}</Label>
            <RichTextEditor
              value={formData.intro}
              onValueChange={(value) => handleInputChange('intro', value)}
              placeholder={t('introPlaceholder')}
              className="min-h-[180px]"
            />
          </div>

          <div>
            <Label htmlFor="content">{t('mainContent')}</Label>
            <RichTextEditor
              value={formData.content}
              onValueChange={(value) => handleInputChange('content', value)}
              placeholder={t('contentPlaceholder')}
              className="min-h-[260px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('seo')}</CardTitle>
          <CardDescription>
            {t('seoSettingsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="seoTitle">{t('seoTitle')}</Label>
            <Input
              id="seoTitle"
              value={formData.seoTitle}
              onChange={(e) => handleInputChange('seoTitle', e.target.value)}
              placeholder={t('seoTitlePlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="seoDescription">{t('seoDescription')}</Label>
            <Textarea
              id="seoDescription"
              value={formData.seoDescription}
              onChange={(e) => handleInputChange('seoDescription', e.target.value)}
              placeholder={t('seoDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="targetKeyword">{t('targetKeyword')}</Label>
              <Input
                id="targetKeyword"
                value={formData.targetKeyword}
                onChange={(e) => handleInputChange('targetKeyword', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="searchIntent">{t('searchIntent')}</Label>
              <Input
                id="searchIntent"
                value={formData.searchIntent}
                onChange={(e) => handleInputChange('searchIntent', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">{t('tags')}</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder={t('tagsPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          {t('updatedSuccessfully')}
        </div>
      )}

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={() => {
          if (dirtyRef.current) setPendingNavigation('back');
          else router.back();
        }}>
          {tc('back')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isLoading ? tc('saving') : tc('save')}
        </Button>
      </div>
      <Dialog open={pendingNavigation !== null} onOpenChange={(open) => {
        if (!open) setPendingNavigation(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{unsavedLabel}</DialogTitle>
            <DialogDescription>{leaveDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingNavigation(null)}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => {
              const destination = pendingNavigation;
              if (!destination) return;
              allowNavigationRef.current = true;
              setPendingNavigation(null);
              if (destination === 'back') router.back();
              else router.push(destination);
            }}>
              {leaveLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}