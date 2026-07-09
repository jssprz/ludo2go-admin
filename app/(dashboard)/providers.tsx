'use client';

import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TimeZoneProvider } from '@/components/timezone-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TimeZoneProvider>
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </TimeZoneProvider>
    </SessionProvider>
  );
}
