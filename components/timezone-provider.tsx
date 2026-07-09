'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ADMIN_TIME_ZONE_COOKIE,
  DEFAULT_ADMIN_TIME_ZONE,
  normalizeTimeZone,
} from '@/lib/date-time';

const STORAGE_KEY = 'ludo2go.admin.timezone';

const COMMON_TIME_ZONES = [
  'UTC',
  'America/Santiago',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

type TimeZoneContextValue = {
  timeZone: string;
  setTimeZone: (timeZone: string) => void;
  options: string[];
};

const TimeZoneContext = createContext<TimeZoneContextValue | null>(null);

function getBrowserTimeZone(): string {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_ADMIN_TIME_ZONE;
  }
}

function getCookieTimeZone(): string | null {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${ADMIN_TIME_ZONE_COOKIE}=`));

  if (!cookie) return null;

  const rawValue = cookie.split('=').slice(1).join('=');
  if (!rawValue) return null;

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function getInitialTimeZone(): string {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_TIME_ZONE;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeTimeZone(stored);

  const fromCookie = getCookieTimeZone();
  if (fromCookie) return normalizeTimeZone(fromCookie);

  return getBrowserTimeZone();
}

export function TimeZoneProvider({ children }: { children: React.ReactNode }) {
  const [timeZone, setTimeZoneState] = useState<string>(getInitialTimeZone);
  const activeTimeZoneRef = useRef<string>(timeZone);
  activeTimeZoneRef.current = timeZone;

  const options = useMemo(() => {
    const set = new Set<string>(COMMON_TIME_ZONES);
    set.add(timeZone);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [timeZone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(STORAGE_KEY, timeZone);
    document.cookie = `${ADMIN_TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
  }, [timeZone]);

  useEffect(() => {
    const originalToLocaleDateString = Date.prototype.toLocaleDateString;
    const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    const originalToLocaleString = Date.prototype.toLocaleString;

    const intlMutable = Intl as unknown as { DateTimeFormat: typeof Intl.DateTimeFormat };
    const originalDateTimeFormat = intlMutable.DateTimeFormat;

    Date.prototype.toLocaleDateString = function patchedToLocaleDateString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ): string {
      return originalToLocaleDateString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone ?? activeTimeZoneRef.current,
      });
    };

    Date.prototype.toLocaleTimeString = function patchedToLocaleTimeString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ): string {
      return originalToLocaleTimeString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone ?? activeTimeZoneRef.current,
      });
    };

    Date.prototype.toLocaleString = function patchedToLocaleString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ): string {
      return originalToLocaleString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone ?? activeTimeZoneRef.current,
      });
    };

    const patchedDateTimeFormat = function patchedDateTimeFormat(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ): Intl.DateTimeFormat {
      return new originalDateTimeFormat(locales, {
        ...options,
        timeZone: options?.timeZone ?? activeTimeZoneRef.current,
      });
    } as unknown as typeof Intl.DateTimeFormat;

    patchedDateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf.bind(originalDateTimeFormat);
    Object.defineProperty(patchedDateTimeFormat, 'prototype', {
      value: originalDateTimeFormat.prototype,
    });
    Object.setPrototypeOf(patchedDateTimeFormat, originalDateTimeFormat);

    intlMutable.DateTimeFormat = patchedDateTimeFormat;

    return () => {
      Date.prototype.toLocaleDateString = originalToLocaleDateString;
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
      Date.prototype.toLocaleString = originalToLocaleString;
      intlMutable.DateTimeFormat = originalDateTimeFormat;
    };
  }, []);

  const value = useMemo<TimeZoneContextValue>(
    () => ({
      timeZone,
      setTimeZone: (nextTimeZone: string) => setTimeZoneState(normalizeTimeZone(nextTimeZone)),
      options,
    }),
    [options, timeZone]
  );

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone() {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error('useTimeZone must be used within TimeZoneProvider');
  }
  return context;
}
