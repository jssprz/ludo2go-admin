import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { BundleEditor } from './bundle-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type PageProps = { params: Promise<{ id: string }> };

export default async function EditBundlePage({ params }: PageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      bundle: {
        include: {
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
          customizableDetails: {
            include: {
              optionGroups: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  options: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                      variant: {
                        select: { id: true, sku: true, product: { select: { name: true } } },
                      },
                      mediaLinks: {
                        orderBy: { sort: 'asc' },
                        include: {
                          media: {
                            select: {
                              id: true,
                              kind: true,
                              url: true,
                              thumbUrl: true,
                              alt: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  variantSelectionRule: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product || product.kind !== 'bundle') {
    notFound();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/bundles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Bundles
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.slug}</p>
        </div>
      </div>

      <BundleEditor product={product as any} />
    </div>
  );
}
