import { prisma } from '@jssprz/ludo2go-database';
import { BrandsTable } from './brands-table';

export const metadata = {
  title: 'Brands | Admin Dashboard',
  description: 'Manage product brands',
};

export default async function BrandsPage() {
  const [brands, mediaAssets] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        logoMedia: true,
        _count: {
          select: { products: true },
        },
      },
    }),
    prisma.mediaAsset.findMany({
      where: { kind: 'image' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground">
            Manage product brands and manufacturers.
          </p>
        </div>
      </div>

      <BrandsTable initialBrands={brands as any} mediaAssets={mediaAssets} />
    </div>
  );
}
