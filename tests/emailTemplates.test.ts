import { expect, test } from 'vitest';
import { emailTemplateSchema, newEmailTemplate } from '../lib/email-templates';
import {
  renderEmailTemplatePreview,
  validateEmailTemplateSyntax
} from '../lib/email-template-rendering';

const template = { ...newEmailTemplate, name: 'Welcome' };

test('validates customer-only keys, canonical locales and nullable sender fields', () => {
  expect(
    emailTemplateSchema.parse({
      ...template,
      locale: 'es-cl',
      fromEmail: '',
      textTemplate: ''
    })
  ).toMatchObject({ locale: 'es-CL', fromEmail: null, textTemplate: null });
  for (const change of [
    { key: 'weekly_analytics_report' },
    { locale: 'not_a_locale' },
    { fromEmail: 'bad-address' },
    { fromName: 'Name\r\nBCC: other' },
    { subjectTemplate: 'Hello\nBCC: other' },
    { htmlTemplate: ' ' }
  ])
    expect(
      emailTemplateSchema.safeParse({ ...template, ...change }).success
    ).toBe(false);
});

test('renders loops, conditions, parent references and escaped HTML without escaping plain text', () => {
  const result = renderEmailTemplatePreview({
    template: {
      ...template,
      subjectTemplate: 'Hola {{customerName}}',
      htmlTemplate:
        '<h1>{{customerName}}</h1>{{#each items}}<p>{{../customerName}}: {{name}}{{#if isGift}} Obsequio{{else}} {{price}}{{/if}}</p>{{/each}}',
      textTemplate: '{{customerName}}: {{#each items}}{{name}} {{/each}}'
    },
    sample: {
      customerName: 'A & B <script>',
      items: [{ name: '<img onerror="bad">', isGift: true, price: '$0' }]
    }
  });
  expect(result.subject).toBe('Hola A & B <script>');
  expect(result.html).toContain('A &amp; B &lt;script&gt;');
  expect(result.html).toContain('Obsequio');
  expect(result.html).not.toContain('<img onerror');
  expect(result.text).toBe('A & B <script>: <img onerror="bad"> ');
});

test('rejects missing variables, malformed syntax and unsupported template features', () => {
  expect(() => renderEmailTemplatePreview({ template, sample: {} })).toThrow(
    'invalid_sample'
  );
  for (const htmlTemplate of [
    '{{#if name}}',
    '{{> shared}}',
    '{{{customerName}}}',
    '{{custom value}}',
    '{{lookup value "name"}}'
  ]) {
    expect(() =>
      validateEmailTemplateSyntax({ ...template, htmlTemplate })
    ).toThrow('invalid_template');
  }
  expect(() =>
    renderEmailTemplatePreview({
      template: { ...template, subjectTemplate: '{{customerName}}' },
      sample: { customerName: 'Name\nBCC: example' }
    })
  ).toThrow('invalid_sample');
});

test('isolates active HTML and preserves inline email styling', () => {
  const result = renderEmailTemplatePreview({
    template: {
      ...template,
      htmlTemplate:
        '<script>alert(1)</script><iframe src="https://example.com"></iframe><a href="https://example.com">Link</a><p style="color:red;padding:20px" onclick="bad()">Text</p><img src="https://example.com/image.png">',
      textTemplate: null
    },
    sample: { customerName: 'Example' }
  });
  expect(result.html).not.toMatch(/<script|<iframe|onclick=|href=/);
  expect(result.html).toContain('style="color:red;padding:20px"');
  expect(result.html).toContain("img-src 'none'");
  expect(result.text).toBeNull();
});

test('bounds sample depth, prototype keys and nested loop expansion', () => {
  expect(() =>
    renderEmailTemplatePreview({
      template,
      sample: JSON.parse('{"constructor":{}}')
    })
  ).toThrow('invalid_sample');
  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let i = 0; i < 14; i++) {
    const child = {};
    cursor.child = child;
    cursor = child;
  }
  expect(() => renderEmailTemplatePreview({ template, sample: deep })).toThrow(
    'invalid_sample'
  );
  expect(() =>
    renderEmailTemplatePreview({
      template: {
        ...template,
        htmlTemplate:
          '{{#each rows}}{{#each @root.rows}}{{#each @root.rows}}x{{/each}}{{/each}}{{/each}}'
      },
      sample: { customerName: 'Example', rows: Array(30).fill('row') }
    })
  ).toThrow('preview_too_large');
});
