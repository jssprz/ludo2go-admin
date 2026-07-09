'use client';

import { Clock3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTimeZone } from '@/components/timezone-provider';

export function TimeZoneSwitcher() {
  const t = useTranslations('timezone');
  const { timeZone, setTimeZone, options } = useTimeZone();

  return (
    <Select value={timeZone} onValueChange={setTimeZone}>
      <SelectTrigger className="w-[210px]">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          <SelectValue placeholder={t('placeholder')} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
