import { prisma } from '@jssprz/ludo2go-database';
import { notFound } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuideEditor } from './guide-editor';
import { GuideBlocksManager } from './guide-blocks-manager';
import { GuideVariantsManager } from './guide-variants-manager';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = {
  title: 'Edit Guide | Admin Dashboard',
  description: 'Edit guide content and settings',
};

export default async function GuideDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('guides');

  const guide = await prisma.guide.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      blocks: {
        orderBy: { sortOrder: 'asc' },
      },
      variants: {
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: { blocks: true, variants: true },
      },
    },
  });

  if (!guide) {
    notFound();
  }

  const categories = await prisma.guideCategory.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{guide.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('editGuideDescription')}
        </p>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">{t('content')}</TabsTrigger>
          <TabsTrigger value="blocks">
            {t('blocks')} ({guide._count.blocks})
          </TabsTrigger>
          <TabsTrigger value="variants">
            {t('variants')} ({guide._count.variants})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <GuideEditor guide={guide} categories={categories} />
        </TabsContent>

        <TabsContent value="blocks" className="space-y-4">
          <GuideBlocksManager guide={guide} />
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <GuideVariantsManager guide={guide} />
        </TabsContent>
      </Tabs>
    </div>
  );
}