'use client';

import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TimeZoneProvider } from '@/components/timezone-provider';
import { SidebarProvider } from './sidebar-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TimeZoneProvider>
        <SidebarProvider>
          <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        </SidebarProvider>
      </TimeZoneProvider>
    </SessionProvider>
  );
}
