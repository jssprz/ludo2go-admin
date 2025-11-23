import { NewProductForm } from './new-product-form';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            New product
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a new product. You can optionally prefill fields from BoardGameGeek.
          </p>
        </div>
      </div>

      <NewProductForm />
    </div>
  );
}