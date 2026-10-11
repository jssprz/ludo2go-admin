import { getTranslations } from 'next-intl/server';
import { Loader2 } from 'lucide-react';

export default async function CustomersLoading() {
  const translate = await getTranslations('CustomerList');
  return (
    <div
      role="status"
      className="flex min-w-0 w-full max-w-full items-center gap-2 py-12 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {translate('loading')}
    </div>
  );
}
