'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PERIODS = [
  { label: '7d', days: '7', title: 'Últimos 7 días' },
  { label: '30d', days: '30', title: 'Últimos 30 días' },
  { label: '90d', days: '90', title: 'Últimos 90 días' },
  { label: 'Todo', days: null, title: 'Todo el historial' },
];

export function PeriodSelector({ current }: { current: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(days: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (days) p.set('days', days);
    else p.delete('days');
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Período de análisis">
      {PERIODS.map(({ label, days, title }) => {
        const active = current === days || (!current && days === null);
        return (
          <Button
            key={label}
            variant={active ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => navigate(days)}
            title={title}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

export function DeltaBadge({ current, previous, higherIsBetter = true, format = 'pct' }: {
  current: number;
  previous: number | null;
  higherIsBetter?: boolean;
  format?: 'pct' | 'abs';
}) {
  if (previous === null || previous === 0) return null;

  const delta = ((current - previous) / previous) * 100;
  const isPositive = delta >= 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const color = isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
  const sign = isPositive ? '+' : '';

  if (format === 'abs') {
    const absDelta = current - previous;
    return (
      <Badge className={`text-xs font-medium ${color}`}>
        {sign}{absDelta.toFixed(0)}
      </Badge>
    );
  }

  return (
    <Badge className={`text-xs font-medium ${color}`}>
      {sign}{delta.toFixed(1)}%
    </Badge>
  );
}
