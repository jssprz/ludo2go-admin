'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Pencil,
  Trash2,
  RefreshCw,
  Plus,
  Save,
  X,
  StickyNote,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTimeZone } from '@/components/timezone-provider';

type Note = {
  id: string;
  body: string;
  authorName: string;
  editorName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  canManage: boolean;
};

export function CustomerNotes({
  customerId,
  locale
}: {
  customerId: string;
  locale: string;
}) {
  const translate = useTranslations('CustomerProfile.notes');
  const { timeZone } = useTimeZone();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [editBody, setEditBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState('');
  const endpoint = `/api/customers/${encodeURIComponent(customerId)}/notes`;
  const legacyKey = `customer-notes-${customerId}`;
  const knownErrors = [
    'setupRequired',
    'unauthorized',
    'forbidden',
    'notFound',
    'conflict',
    'invalid',
    'failed'
  ];

  function errorKey(code: unknown) {
    return typeof code === 'string' && knownErrors.includes(code)
      ? code
      : 'failed';
  }
  function formatTime(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone
    }).format(new Date(value));
  }

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) {
        setError(errorKey(result.code));
        return;
      }
      setNotes(result.notes);
    } catch {
      if (!signal?.aborted) setError('failed');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setNotes([]);
    setDraft('');
    setEditing(null);
    try {
      setLegacy(localStorage.getItem(legacyKey) ?? '');
    } catch {
      setLegacy('');
    }
    void load(controller.signal);
    return () => controller.abort();
  }, [customerId]);

  async function mutate(
    method: 'POST' | 'PATCH' | 'DELETE',
    note?: Note,
    imported = false
  ) {
    setBusy(true);
    setError(null);
    try {
      const body =
        method === 'DELETE'
          ? { version: note!.version }
          : method === 'PATCH'
            ? { body: editBody, version: note!.version }
            : { body: imported ? legacy : draft };
      const response = await fetch(
        note ? `${endpoint}/${encodeURIComponent(note.id)}` : endpoint,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(errorKey(result.code));
        return;
      }
      if (imported) {
        setLegacy('');
        try {
          localStorage.removeItem(legacyKey);
        } catch {}
      } else if (method === 'POST') setDraft('');
      setEditing(null);
      await load();
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-labelledby="customer-notes-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="customer-notes-title"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <StickyNote className="h-4 w-4" />
          {translate('title')}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          disabled={busy || loading}
          aria-label={translate('retry')}
          title={translate('retry')}
          onClick={() => {
            setEditing(null);
            void load();
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {translate(`errors.${error}`)}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate('loading')}
        </p>
      ) : notes.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">{translate('empty')}</p>
      ) : null}
      <div className="space-y-4">
        {notes.map((note) => (
          <article key={note.id} className="border-b pb-3 space-y-2">
            {editing?.id === note.id ? (
              <>
                <Textarea
                  aria-label={translate('edit')}
                  value={editBody}
                  maxLength={10000}
                  disabled={busy}
                  onChange={(event) => setEditBody(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy || !editBody.trim()}
                    onClick={() => void mutate('PATCH', editing)}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {translate('save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {translate('cancel')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm">
                {note.body}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {translate('created', {
                author: note.authorName,
                date: formatTime(note.createdAt)
              })}
            </p>
            {note.version > 1 && (
              <p className="text-xs text-muted-foreground">
                {translate('edited', {
                  author: note.editorName,
                  date: formatTime(note.updatedAt)
                })}
              </p>
            )}
            {note.canManage && (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || loading}
                  title={translate('edit')}
                  aria-label={translate('edit')}
                  onClick={() => {
                    setEditing(note);
                    setEditBody(note.body);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || loading}
                  title={translate('delete')}
                  aria-label={translate('delete')}
                  onClick={() => {
                    if (window.confirm(translate('confirmDelete')))
                      void mutate('DELETE', note);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      {legacy.trim() && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {translate('legacyAvailable')}
          </p>
          <details className="text-xs">
            <summary>{translate('legacyPreview')}</summary>
            <p className="whitespace-pre-wrap break-words py-2">{legacy}</p>
          </details>
          <Button
            className="h-auto whitespace-normal text-left"
            variant="outline"
            size="sm"
            disabled={busy || loading || Boolean(error)}
            onClick={() => void mutate('POST', undefined, true)}
          >
            <Upload className="h-4 w-4 shrink-0 mr-1" />
            {translate('importLegacy')}
          </Button>
        </div>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate('POST');
        }}
      >
        <Textarea
          aria-label={translate('title')}
          placeholder={translate('placeholder')}
          value={draft}
          maxLength={10000}
          disabled={busy || loading || error === 'setupRequired'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="sm"
          disabled={
            busy || loading || !draft.trim() || error === 'setupRequired'
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          {translate('add')}
        </Button>
      </form>
    </section>
  );
}
