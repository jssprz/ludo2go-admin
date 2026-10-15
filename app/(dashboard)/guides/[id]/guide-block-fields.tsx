'use client';

import { useEffect, useId, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import type { BlockField } from '@/lib/guide-blocks';

export type FieldIssues = Record<string, string>;
type RecordValue = Record<string, unknown>;

export function readField(value: RecordValue, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as RecordValue)[key]
          : undefined,
      value
    );
}

export function writeField(
  value: RecordValue,
  path: string,
  next: unknown
): RecordValue {
  const [key, ...rest] = path.split('.');
  if (!rest.length) return { ...value, [key]: next };
  const child = value[key];
  return {
    ...value,
    [key]: writeField(
      child && typeof child === 'object' && !Array.isArray(child)
        ? (child as RecordValue)
        : {},
      rest.join('.'),
      next
    )
  };
}

type Variant = {
  id: string;
  sku: string;
  displayTitleShort?: string | null;
  displayTitleLong?: string | null;
  edition?: string | null;
  imageUrl?: string | null;
  availableQuantity: number;
  isAvailable: boolean;
  product: { name: string; slug: string };
};

function ProductSelector({
  value,
  single,
  onChange,
  id,
  invalid
}: {
  value: unknown;
  single: boolean;
  onChange: (value: unknown) => void;
  id: string;
  invalid: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Variant[]>([]);
  const [status, setStatus] = useState('');
  const selected =
    typeof value === 'string'
      ? value
        ? [value]
        : []
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];

  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setStatus(query.trim() ? 'Searching...' : '');
    if (!query.trim()) return () => controller.abort();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/variants/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Product search failed');
        const variants: Variant[] = await response.json();
        if (!controller.signal.aborted) {
          setResults(variants);
          setStatus(variants.length ? '' : 'No matching products');
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setStatus(
            error instanceof Error ? error.message : 'Product search failed'
          );
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by product name or SKU"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      <div className="flex flex-wrap gap-2">
        {selected.map((slug) => (
          <span
            key={slug}
            className="inline-flex max-w-full items-center gap-1 rounded border px-2 py-1 text-sm"
          >
            <span className="break-all">{slug}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label={`Remove ${slug}`}
              title={`Remove ${slug}`}
              onClick={() =>
                onChange(single ? '' : selected.filter((item) => item !== slug))
              }
            >
              <X className="h-3 w-3" />
            </Button>
          </span>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {status}
      </p>
      {results.length > 0 && (
        <ul className="max-h-64 overflow-y-auto rounded border">
          {results.map((variant) => (
            <li key={variant.id}>
              <button
                type="button"
                disabled={selected.includes(variant.product.slug)}
                className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-accent disabled:opacity-50"
                onClick={() => {
                  onChange(
                    single
                      ? variant.product.slug
                      : [...selected, variant.product.slug]
                  );
                  setQuery('');
                }}
              >
                {variant.imageUrl ? (
                  <img
                    src={variant.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 object-contain"
                  />
                ) : (
                  <span className="h-12 w-12 shrink-0 bg-muted" />
                )}
                <span className="min-w-0 break-words text-sm">
                  <span className="block font-medium">
                    {variant.product.name}
                  </span>
                  <span className="block">
                    {variant.displayTitleShort ||
                      variant.displayTitleLong ||
                      variant.edition ||
                      'Standard variant'}{' '}
                    · {variant.sku}
                  </span>
                  <span
                    className={`block ${variant.isAvailable ? 'text-green-700' : 'text-muted-foreground'}`}
                  >
                    {variant.isAvailable ? 'Available' : 'Unavailable'} ·{' '}
                    {variant.availableQuantity} in stock
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GuideBlockFields({
  fields,
  value,
  onChange,
  issues = {},
  prefix = ''
}: {
  fields: BlockField[];
  value: RecordValue;
  onChange: (value: RecordValue) => void;
  issues?: FieldIssues;
  prefix?: string;
}) {
  const instanceId = useId();
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const path = prefix ? `${prefix}.${field.path}` : field.path;
        const id = `${instanceId}-${field.path}`;
        const current = readField(value, field.path);
        const update = (next: unknown) =>
          onChange(writeField(value, field.path, next));
        const error = issues[path];
        const text = typeof current === 'string' ? current : '';
        const items = Array.isArray(current) ? current : [];
        return (
          <div key={field.path} className="min-w-0 space-y-2">
            <Label htmlFor={id}>
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            {field.kind === 'items' ? (
              <fieldset id={id} className="space-y-3" aria-label={field.label}>
                {items.map((item, index) => (
                  <div key={index} className="space-y-2 border-l-2 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {field.label} {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${field.label} ${index + 1}`}
                        title="Remove item"
                        onClick={() =>
                          update(
                            items.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <GuideBlockFields
                      fields={field.fields ?? []}
                      value={
                        item && typeof item === 'object' && !Array.isArray(item)
                          ? (item as RecordValue)
                          : {}
                      }
                      prefix={`${path}.${index}`}
                      issues={issues}
                      onChange={(next) =>
                        update(
                          items.map((existing, itemIndex) =>
                            itemIndex === index ? next : existing
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    update([
                      ...items,
                      Object.fromEntries(
                        (field.fields ?? []).map((child) => [
                          child.path,
                          ['strings', 'items', 'products'].includes(
                            child.kind
                          ) && !child.path.endsWith('productSlug')
                            ? []
                            : ''
                        ])
                      )
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </fieldset>
            ) : field.kind === 'products' ? (
              <ProductSelector
                id={id}
                value={current}
                single={field.path.endsWith('productSlug')}
                onChange={update}
                invalid={Boolean(error)}
              />
            ) : field.kind === 'strings' ? (
              <div
                id={id}
                className="space-y-2"
                role="group"
                aria-label={field.label}
              >
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      aria-label={`${field.label} ${index + 1}`}
                      value={typeof item === 'string' ? item : ''}
                      onChange={(event) =>
                        update(
                          items.map((existing, itemIndex) =>
                            itemIndex === index ? event.target.value : existing
                          )
                        )
                      }
                      aria-invalid={Boolean(issues[`${path}.${index}`])}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${field.label} ${index + 1}`}
                      title="Remove item"
                      onClick={() =>
                        update(
                          items.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-destructive">
                      {issues[`${path}.${index}`]}
                    </span>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => update([...items, ''])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </div>
            ) : field.kind === 'richtext' ? (
              <div
                id={id}
                role="group"
                aria-label={field.label}
                aria-invalid={Boolean(error)}
              >
                <RichTextEditor value={text} onValueChange={update} />
              </div>
            ) : field.kind === 'textarea' ? (
              <Textarea
                id={id}
                value={text}
                onChange={(event) => update(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            ) : (
              <Input
                id={id}
                value={text}
                onChange={(event) =>
                  update(
                    !field.required &&
                      !event.target.value &&
                      field.path.startsWith('data.')
                      ? undefined
                      : event.target.value
                  )
                }
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            )}
            {field.kind === 'image' && text && (
              <img
                src={text}
                alt="Image preview"
                className="max-h-40 max-w-full object-contain"
              />
            )}
            {error && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
