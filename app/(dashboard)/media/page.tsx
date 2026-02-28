import { Suspense } from 'react';
import { prisma } from '@jssprz/ludo2go-database';
import { MediaGallery } from './media-gallery';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';


export default async function MediaPage() {
  const t = await getTranslations('media');

  // Get stats
  const [totalCount, imageCount, videoCount, pdfCount] = await Promise.all([
    prisma.mediaAsset.count(),
    prisma.mediaAsset.count({ where: { kind: 'image' } }),
    prisma.mediaAsset.count({ where: { kind: 'video' } }),
    prisma.mediaAsset.count({ where: { kind: 'pdf' } }),
  ]);

  // Get total storage used (approximate)
  const storageStats = await prisma.mediaAsset.aggregate({
    _sum: {
      sizeBytes: true,
    },
  });

  const totalSizeBytes = storageStats._sum.sizeBytes || 0;
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('totalAssets')}</CardDescription>
            <CardTitle className="text-3xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('imageAssets')}</CardDescription>
            <CardTitle className="text-3xl">{imageCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('videoAssets')}</CardDescription>
            <CardTitle className="text-3xl">{videoCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('storageUsed')}</CardDescription>
            <CardTitle className="text-3xl">{totalSizeMB} MB</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Media Gallery */}
      <Suspense fallback={<div>{t('loadingGallery')}</div>}>
        <MediaGallery />
      </Suspense>
    </div>
  );
}
