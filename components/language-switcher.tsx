'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Loader2 } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isChanging, setIsChanging] = useState(false);

  async function handleLocaleChange(newLocale: string) {
    if (newLocale === locale) return;
    
    setIsChanging(true);
    
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (error) {
      console.error('Failed to change locale:', error);
    } finally {
      setIsChanging(false);
    }
  }

  const currentLanguage = languages.find((l) => l.code === locale);

  return (
    <Select value={locale} onValueChange={handleLocaleChange} disabled={isChanging || isPending}>
      <SelectTrigger className="w-[140px]">
        {isChanging || isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <SelectValue>
              {currentLanguage?.flag} {currentLanguage?.name}
            </SelectValue>
          </div>
        )}
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              {lang.flag} {lang.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
