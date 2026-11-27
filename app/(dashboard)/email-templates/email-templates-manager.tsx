'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  CUSTOMER_EMAIL_KEYS,
  emailPreviewSample,
  newEmailTemplate,
  type EmailTemplateInput,
  type EmailTemplateRecord
} from '@/lib/email-templates';

type Preview = { subject: string; html: string; text: string | null };
type Editor = {
  template: EmailTemplateInput;
  record: EmailTemplateRecord | null;
};

class RequestError extends Error {
  constructor(
    public code: string,
    public detail?: string
  ) {
    super(code);
  }
}

async function request<T>(
  url: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok)
    throw new RequestError(data.error || 'request_failed', data.detail);
  return data;
}

export function EmailTemplatesManager() {
  const t = useTranslations('emailTemplates');
  const tc = useTranslations('common');
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sample, setSample] = useState(
    JSON.stringify(emailPreviewSample, null, 2)
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function describeError(cause: unknown) {
    if (cause instanceof SyntaxError) return t('invalid_json');
    if (cause instanceof RequestError) {
      const code = t.has(cause.code) ? cause.code : 'request_failed';
      return `${t(code)}${cause.detail ? ` ${cause.detail}` : ''}`;
    }
    return t('request_failed');
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await request<{ templates: EmailTemplateRecord[] }>(
        '/api/email-templates'
      );
      setTemplates(data.templates);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const dirty =
    editor !== null &&
    (editor.record === null ||
      JSON.stringify(editor.template) !==
        JSON.stringify(toInput(editor.record)));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function toInput(record: EmailTemplateRecord): EmailTemplateInput {
    const { id, createdAt, updatedAt, ...input } = record;
    return input;
  }

  function open(record: EmailTemplateRecord | null) {
    if (dirty && !window.confirm(t('discard'))) return;
    setEditor({
      record,
      template: record ? toInput(record) : { ...newEmailTemplate }
    });
    setPreview(null);
    setError(null);
    setNotice(null);
  }

  function change(field: keyof EmailTemplateInput, value: string) {
    if (!editor) return;
    setEditor({ ...editor, template: { ...editor.template, [field]: value } });
    setPreview(null);
    setNotice(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const record = editor.record;
      const saved = await request<EmailTemplateRecord>(
        record ? `/api/email-templates/${record.id}` : '/api/email-templates',
        record ? 'PUT' : 'POST',
        {
          ...editor.template,
          ...(record ? { updatedAt: record.updatedAt } : {})
        }
      );
      setTemplates((current) => [
        ...current.filter((item) => item.id !== saved.id),
        saved
      ]);
      setEditor({ record: saved, template: toInput(saved) });
      setNotice(t('saved'));
      setPreview(null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: EmailTemplateRecord) {
    if (!window.confirm(t('confirmDelete', { name: record.name }))) return;
    if (
      dirty &&
      editor?.record?.id === record.id &&
      !window.confirm(t('discard'))
    )
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await request(`/api/email-templates/${record.id}`, 'DELETE', {
        updatedAt: record.updatedAt
      });
      setTemplates((current) =>
        current.filter((item) => item.id !== record.id)
      );
      if (editor?.record?.id === record.id) {
        setEditor(null);
        setPreview(null);
      }
      setNotice(t('deleted'));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function renderPreview() {
    if (!editor) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const result = await request<Preview>(
        '/api/email-templates/preview',
        'POST',
        {
          template: editor.template,
          sample: JSON.parse(sample)
        }
      );
      setPreview(result);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  const filtered = templates.filter((item) =>
    `${item.name} ${item.key} ${item.locale}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );
  const fields = [
    'name',
    'locale',
    'description',
    'fromName',
    'fromEmail',
    'replyToEmail',
    'subjectTemplate',
    'htmlTemplate',
    'textTemplate'
  ] as const;

  return (
    <div className="space-y-4">
      <p className="rounded-md border p-3 text-sm text-muted-foreground">
        {t('scope')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={tc('search')}
          placeholder={tc('search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Button disabled={busy} onClick={() => open(null)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('new')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            if (dirty && !window.confirm(t('discard'))) return;
            setEditor(null);
            setPreview(null);
            setNotice(null);
            void load();
          }}
        >
          {t('reload')}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="whitespace-pre-wrap rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">{tc('loading')}</p>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('key')}</TableHead>
                  <TableHead>{t('locale')}</TableHead>
                  <TableHead>{tc('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.name}</TableCell>
                    <TableCell>
                      <code>{record.key}</code>
                    </TableCell>
                    <TableCell>{record.locale}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => open(record)}
                      >
                        {tc('edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(record)}
                      >
                        {tc('delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={4}>{t('empty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {editor && (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={save} className="space-y-4">
              <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-key">{t('key')}</Label>
                  <select
                    id="template-key"
                    value={editor.template.key}
                    onChange={(event) => change('key', event.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {CUSTOMER_EMAIL_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
                {fields.map((field) => {
                  const multiline = [
                    'description',
                    'htmlTemplate',
                    'textTemplate'
                  ].includes(field);
                  return (
                    <div
                      key={field}
                      className={`space-y-2 ${multiline || field === 'subjectTemplate' ? 'md:col-span-2' : ''}`}
                    >
                      <Label htmlFor={`template-${field}`}>{t(field)}</Label>
                      {multiline ? (
                        <Textarea
                          id={`template-${field}`}
                          value={editor.template[field] ?? ''}
                          onChange={(event) =>
                            change(field, event.target.value)
                          }
                          rows={field === 'htmlTemplate' ? 14 : 4}
                          className={
                            field !== 'description' ? 'font-mono text-sm' : ''
                          }
                          required={field === 'htmlTemplate'}
                        />
                      ) : (
                        <Input
                          id={`template-${field}`}
                          type={
                            field === 'fromEmail' || field === 'replyToEmail'
                              ? 'email'
                              : 'text'
                          }
                          value={editor.template[field] ?? ''}
                          onChange={(event) =>
                            change(field, event.target.value)
                          }
                          required={[
                            'name',
                            'locale',
                            'subjectTemplate'
                          ].includes(field)}
                        />
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <p className="text-sm text-muted-foreground">{t('senderHint')}</p>
              <p className="text-sm text-muted-foreground">{t('syntaxHint')}</p>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tc('save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (dirty && !window.confirm(t('discard'))) return;
                    setEditor(null);
                    setPreview(null);
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {tc('cancel')}
                </Button>
              </div>
            </form>
            <div className="space-y-3 border-t pt-4">
              <Label htmlFor="preview-sample">{t('sample')}</Label>
              <p className="text-sm text-muted-foreground">{t('sampleHint')}</p>
              <Textarea
                id="preview-sample"
                value={sample}
                disabled={busy}
                onChange={(event) => {
                  setSample(event.target.value);
                  setPreview(null);
                }}
                rows={12}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void renderPreview()}>
                  {t('preview')}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setSample(JSON.stringify(emailPreviewSample, null, 2));
                    setPreview(null);
                  }}
                >
                  {t('resetSample')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('previewHint')}
              </p>
              {preview && (
                <div className="space-y-3">
                  <h2 className="font-semibold">{t('renderedSubject')}</h2>
                  <p>{preview.subject}</p>
                  <iframe
                    title={t('htmlPreview')}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={preview.html}
                    className="h-[600px] w-full rounded-md border bg-white"
                  />
                  <h2 className="font-semibold">{t('textPreview')}</h2>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                    {preview.text ?? t('noText')}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
