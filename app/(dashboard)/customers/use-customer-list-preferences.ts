'use client';

import { useEffect, useRef, useState } from 'react';
import {
  customerListPreferencesPayloadSchema,
  customerListPreferencesSchema,
  EMPTY_CUSTOMER_LIST_PREFERENCES,
  type CustomerListPreferences
} from '@/lib/customer-list-preferences';

const endpoint = '/api/customers/preferences';
const errorCodes = new Set([
  'setupRequired',
  'unauthorized',
  'forbidden',
  'invalid',
  'conflict'
]);

function responseError(value: unknown) {
  const code =
    value && typeof value === 'object' && 'code' in value ? value.code : null;
  return typeof code === 'string' && errorCodes.has(code) ? code : 'failed';
}

export function useCustomerListPreferences(adminId: string | undefined) {
  const [preferences, setPreferences] = useState(
    EMPTY_CUSTOMER_LIST_PREFERENCES
  );
  const [loadedAdminId, setLoadedAdminId] = useState<string | undefined>(
    undefined
  );
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<CustomerListPreferences | null>(null);
  const [revision, setRevision] = useState(0);
  const version = useRef(0);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    busy.current = false;
    version.current = 0;
    setPreferences(EMPTY_CUSTOMER_LIST_PREFERENCES);
    setLoadedAdminId(undefined);
    setReady(false);
    setSaving(false);
    setError(null);
    setLegacy(null);
    if (!adminId) return () => controller.abort();
    async function load() {
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          signal: controller.signal
        });
        const body: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(responseError(body));
          return;
        }
        const result = customerListPreferencesPayloadSchema.parse(body);
        version.current = result.version;
        setPreferences(result.preferences);
        setLoadedAdminId(adminId);
        setReady(true);
        if (result.version === 0) {
          try {
            const stored =
              localStorage.getItem(`jobys:customer-list:${adminId}`) ??
              localStorage.getItem(`jobys:customer-crm:${adminId}`);
            if (stored) {
              const parsed = customerListPreferencesSchema.safeParse(
                JSON.parse(stored)
              );
              if (parsed.success) setLegacy(parsed.data);
            }
          } catch {}
        }
      } catch {
        if (!controller.signal.aborted) setError('failed');
      }
    }
    void load();
    return () => controller.abort();
  }, [adminId, revision]);

  async function persist(next: CustomerListPreferences): Promise<boolean> {
    const controller = request.current;
    if (
      !adminId ||
      loadedAdminId !== adminId ||
      !ready ||
      busy.current ||
      !controller ||
      controller.signal.aborted
    )
      return false;
    const parsed = customerListPreferencesSchema.safeParse(next);
    if (!parsed.success) {
      setError('invalid');
      return false;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: parsed.data,
          version: version.current
        }),
        signal: controller.signal
      });
      const body: unknown = await response.json();
      if (controller.signal.aborted) return false;
      if (!response.ok) {
        setError(responseError(body));
        if (response.status === 409) setReady(false);
        return false;
      }
      const result = customerListPreferencesPayloadSchema.parse(body);
      version.current = result.version;
      setPreferences(result.preferences);
      setLegacy(null);
      return true;
    } catch {
      if (!controller.signal.aborted) setError('failed');
      return false;
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false;
        setSaving(false);
      }
    }
  }

  return {
    preferences:
      loadedAdminId === adminId ? preferences : EMPTY_CUSTOMER_LIST_PREFERENCES,
    ready: ready && loadedAdminId === adminId,
    saving,
    error,
    legacy: loadedAdminId === adminId ? legacy : null,
    persist,
    reload: () => {
      if (!busy.current) setRevision((value) => value + 1);
    }
  };
}
