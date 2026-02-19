import { Suspense } from 'react';
import { prisma } from '@jssprz/ludo2go-database';
import { MediaGallery } from './media-gallery';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function MediaPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Media Gallery</h1>
        <p className="text-muted-foreground">
          Manage images, videos, and other media assets
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Assets</CardDescription>
            <CardTitle className="text-3xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Images</CardDescription>
            <CardTitle className="text-3xl">{imageCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Videos</CardDescription>
            <CardTitle className="text-3xl">{videoCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Storage Used</CardDescription>
            <CardTitle className="text-3xl">{totalSizeMB} MB</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Media Gallery */}
      <Suspense fallback={<div>Loading gallery...</div>}>
        <MediaGallery />
      </Suspense>
    </div>
  );
}
