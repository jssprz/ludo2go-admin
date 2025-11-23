import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { ProductEditForm } from './product-edit-form';

type PageProps = {
  params: {
    id: string;
  };
};

export default async function EditProductPage({ params }: PageProps) {
  const { id } = params;

  const product = await prisma.product.findUnique({
    where: { id: id },
    include: {
      game: true,
      accessory: true,
      bundle: true,
      bgg: true,
    },
  });

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit product
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the core information of this product.
          </p>
        </div>
      </div>

      <ProductEditForm product={product} />
    </div>
  );
}