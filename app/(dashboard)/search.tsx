'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/icons';
import { Search } from 'lucide-react';

export function SearchInput() {
  const router = useRouter();
  const currentParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  function searchAction(formData: FormData) {
    let value = formData.get('q') as string;
    // Preserve existing filter/sort params when searching
    const params = new URLSearchParams(currentParams.toString());
    params.set('q', value);
    params.delete('offset'); // Reset pagination on new search
    startTransition(() => {
      router.replace(`/products/?${params.toString()}`);
    });
  }

  if (pathname.startsWith('/customers')) return <div className="min-w-0 flex-1" />;

  return (
    <form action={searchAction} className="relative ml-auto min-w-0 flex-1 xl:max-w-[336px]">
      <Search className="absolute left-2.5 top-[.75rem] h-4 w-4 text-muted-foreground" />
      <Input
        name="q"
        type="search"
        placeholder="Search..."
        className="w-full rounded-lg bg-background pl-8"
      />
      {isPending && <Spinner />}
    </form>
  );
}
