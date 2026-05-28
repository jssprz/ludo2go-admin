import { prisma } from '@jssprz/ludo2go-database';
import { BundlesTable } from './bundles-table';

export default async function BundlesPage() {
  const bundles = await prisma.product.findMany({
    where: { kind: 'bundle' },
    orderBy: { name: 'asc' },
    include: {
      brand: { select: { id: true, name: true } },
      bundle: {
        include: {
          items: true,
          customizableDetails: {
            select: { bundleProductId: true, pricingMode: true },
          },
        },
      },
    },
  });

  return (
    <div className="p-4 md:p-6">
      <BundlesTable initialBundles={bundles as any} />
    </div>
  );
}
