'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { SupplierIntegrationInput } from '@/lib/supplier-integration-schema';
import { createSupplierIntegrationDefaults } from '@/lib/supplier-integration-defaults';

const referenceFields = [
  'usernameSecretRef',
  'passwordSecretRef',
  'sessionSecretRef',
  'browserSecretRef'
] as const;
const origins = {
  asmodee: 'https://b2b.asmodee.cl',
  devir: 'https://btb.devir.cl',
  lanae: 'https://lanae.cl'
};

export function SupplierIntegrationDialog({
  supplier,
  onClose
}: {
  supplier: { id: string; name: string };
  onClose: () => void;
}) {
  const t = useTranslations('supplierIntegration');
  const [form, setForm] = useState(() =>
    createSupplierIntegrationDefaults('devir')
  );
  const [configText, setConfigText] = useState(() =>
    JSON.stringify(createSupplierIntegrationDefaults('devir').config, null, 2)
  );
  const [baseline, setBaseline] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const dirty =
    baseline !== '' && baseline !== JSON.stringify({ form, configText });
  const endpoint = `/api/suppliers/${encodeURIComponent(supplier.id)}/integration`;

  function accept(data: {
    integration: SupplierIntegrationInput | null;
    configVersion: number | null;
  }) {
    const next = data.integration ?? createSupplierIntegrationDefaults('devir');
    const text = JSON.stringify(next.config, null, 2);
    setForm(next);
    setConfigText(text);
    setVersion(data.configVersion);
    setBaseline(JSON.stringify({ form: next, configText: text }));
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSaved(false);
    void fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) accept(data);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error && t.has(failure.message)
              ? failure.message
              : 'integration_request_failed'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, reload, t]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function close() {
    if (!saving && (!dirty || window.confirm(t('discard')))) onClose();
  }
  function change<Key extends keyof SupplierIntegrationInput>(
    key: Key,
    value: SupplierIntegrationInput[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  function loadObservedDefaults() {
    if (dirty && !window.confirm(t('replaceWithDefaults'))) return;
    const defaults = createSupplierIntegrationDefaults(form.adapterKey);
    setForm((current) => ({
      ...defaults,
      updatedAt: current.updatedAt,
      usernameSecretRef:
        current.usernameSecretRef ?? defaults.usernameSecretRef,
      passwordSecretRef:
        current.passwordSecretRef ?? defaults.passwordSecretRef,
      sessionSecretRef: current.sessionSecretRef ?? defaults.sessionSecretRef,
      browserSecretRef: current.browserSecretRef ?? defaults.browserSecretRef
    }));
    setConfigText(JSON.stringify(defaults.config, null, 2));
    setInvalidFields([]);
    setError(null);
    setSaved(false);
  }
  async function save() {
    setError(null);
    setInvalidFields([]);
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('invalid_json');
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, config })
      });
      const data = await response.json();
      if (!response.ok) {
        setInvalidFields(
          Array.isArray(data.fields)
            ? data.fields.filter(
                (field: unknown) => typeof field === 'string' && field in form
              )
            : []
        );
        setError(
          typeof data.error === 'string' && t.has(data.error)
            ? data.error
            : 'integration_request_failed'
        );
        return;
      }
      accept(data);
      setSaved(true);
    } catch {
      setError('integration_request_failed');
    } finally {
      setSaving(false);
    }
  }
  const fieldClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl flex-col overflow-hidden p-4 sm:p-6"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle className="break-words leading-tight">
            {t('title')} · {supplier.name}
          </DialogTitle>
          <DialogDescription>
            {version === null ? t('newDraft') : t('version', { version })}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div role="status" className="flex items-center gap-2 py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            {baseline && (
              <fieldset disabled={saving} className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="integration-enabled"
                  >
                    <input
                      id="integration-enabled"
                      type="checkbox"
                      checked={form.isEnabled}
                      onChange={(event) =>
                        change('isEnabled', event.target.checked)
                      }
                    />
                    {t('isEnabled')}
                  </Label>
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="integration-browser"
                  >
                    <input
                      id="integration-browser"
                      type="checkbox"
                      checked={form.browserRendering}
                      onChange={(event) =>
                        change('browserRendering', event.target.checked)
                      }
                    />
                    {t('browserRendering')}
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="integration-adapter">
                      {t('adapterKey')}
                    </Label>
                    <select
                      id="integration-adapter"
                      className={fieldClass}
                      value={form.adapterKey}
                      onChange={(event) => {
                        const adapterKey = event.target
                          .value as SupplierIntegrationInput['adapterKey'];
                        const defaults =
                          createSupplierIntegrationDefaults(adapterKey);
                        setForm((current) => ({
                          ...current,
                          ...defaults,
                          updatedAt: current.updatedAt,
                          integrationVerifiedAt: null,
                          isEnabled: false
                        }));
                        setConfigText(JSON.stringify(defaults.config, null, 2));
                        setSaved(false);
                      }}
                    >
                      <option value="asmodee">Asmodee</option>
                      <option value="devir">Devir</option>
                      <option value="lanae">Lanae</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="integration-auth">{t('authMethod')}</Label>
                    <select
                      id="integration-auth"
                      className={fieldClass}
                      value={form.authMethod}
                      onChange={(event) =>
                        change(
                          'authMethod',
                          event.target
                            .value as SupplierIntegrationInput['authMethod']
                        )
                      }
                    >
                      {form.adapterKey === 'asmodee' && (
                        <option value="asmodee_api">{t('asmodee_api')}</option>
                      )}
                      {form.adapterKey === 'devir' && (
                        <option value="form">{t('form')}</option>
                      )}
                      <option value="browser_session">
                        {t('browser_session')}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="integration-url">{t('baseUrl')}</Label>
                    <Input
                      id="integration-url"
                      value={form.baseUrl}
                      placeholder={origins[form.adapterKey]}
                      onChange={(event) =>
                        change('baseUrl', event.target.value)
                      }
                      aria-invalid={invalidFields.includes('baseUrl')}
                    />
                  </div>
                  {referenceFields.map((key) => (
                    <div key={key} className="min-w-0 space-y-1.5">
                      <Label
                        htmlFor={`integration-${key}`}
                        title={t('referenceHint')}
                      >
                        {t(key)}
                      </Label>
                      <Input
                        id={`integration-${key}`}
                        value={form[key] ?? ''}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={`SUPPLIER_${form.adapterKey.toUpperCase()}_${key.replace('SecretRef', '').toUpperCase()}`}
                        title={t('referenceHint')}
                        aria-invalid={invalidFields.includes(key)}
                        onChange={(event) =>
                          change(key, event.target.value || null)
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="integration-tax">{t('taxTreatment')}</Label>
                    <select
                      id="integration-tax"
                      className={fieldClass}
                      value={form.taxTreatment}
                      onChange={(event) => {
                        change(
                          'taxTreatment',
                          event.target
                            .value as SupplierIntegrationInput['taxTreatment']
                        );
                        if (event.target.value === 'unconfirmed')
                          change('taxVerifiedAt', null);
                      }}
                    >
                      {(
                        [
                          'unconfirmed',
                          'vat_included',
                          'excluding_vat'
                        ] as const
                      ).map((value) => (
                        <option key={value} value={value}>
                          {t(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(['taxVerifiedAt', 'integrationVerifiedAt'] as const).map(
                    (key) => (
                      <div key={key} className="min-w-0 space-y-1.5">
                        <Label
                          htmlFor={`integration-${key}`}
                          title={t('verificationHint')}
                        >
                          {t(key)}
                        </Label>
                        <Input
                          id={`integration-${key}`}
                          value={form[key] ?? ''}
                          disabled={
                            key === 'taxVerifiedAt' &&
                            form.taxTreatment === 'unconfirmed'
                          }
                          placeholder="YYYY-MM-DDTHH:mm:ssZ"
                          title={t('verificationHint')}
                          aria-invalid={invalidFields.includes(key)}
                          onChange={(event) =>
                            change(key, event.target.value || null)
                          }
                        />
                      </div>
                    )
                  )}
                </div>
                <details
                  className="border-t pt-3"
                  open={
                    error === 'invalid_json' || invalidFields.includes('config')
                      ? true
                      : undefined
                  }
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    {t('advanced')}
                  </summary>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={loadObservedDefaults}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t('loadObservedDefaults')}
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="integration-config">{t('config')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('observedDefaultsHint')}
                    </p>
                    <Textarea
                      id="integration-config"
                      rows={12}
                      value={configText}
                      spellCheck={false}
                      className="font-mono text-xs"
                      onChange={(event) => {
                        setConfigText(event.target.value);
                        setSaved(false);
                      }}
                      aria-invalid={
                        error === 'invalid_json' ||
                        invalidFields.includes('config')
                      }
                    />
                  </div>
                </details>
              </fieldset>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="shrink-0 text-sm text-destructive">
            <p>{t(error)}</p>
            {invalidFields.length > 0 && (
              <p>{invalidFields.map((field) => t(field)).join(', ')}</p>
            )}
          </div>
        )}
        {saved && (
          <p role="status" className="text-sm text-green-700">
            {t('saved')}
          </p>
        )}
        <DialogFooter className="shrink-0 gap-2 border-t pt-3 sm:space-x-0">
          <Button
            variant="outline"
            disabled={loading || saving}
            onClick={() => {
              if (!dirty || window.confirm(t('discard'))) {
                setBaseline('');
                setReload((current) => current + 1);
              }
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('reload')}
          </Button>
          <Button variant="outline" disabled={saving} onClick={close}>
            <X className="mr-2 h-4 w-4" />
            {t('cancel')}
          </Button>
          <Button
            disabled={loading || saving || !baseline || !dirty}
            onClick={() => void save()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t(saving ? 'saving' : 'save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
