'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type SidebarContextValue = {
  isPinned: boolean;
  togglePin: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  isPinned: false,
  togglePin: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-pinned');
    if (stored === 'true') setIsPinned(true);
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-pinned', String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isPinned, togglePin }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
