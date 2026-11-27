import Handlebars from 'handlebars';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { emailTemplateSchema } from './email-templates';

const engine = Handlebars.create();
engine.unregisterHelper('lookup');
engine.unregisterHelper('log');
const compileOptions: CompileOptions = {
  strict: true,
  knownHelpersOnly: true,
  knownHelpers: { lookup: false, log: false }
};

export class EmailTemplateError extends Error {
  constructor(
    public code: string,
    public detail?: string
  ) {
    super(code);
  }
}

export function validateEmailTemplateSyntax(template: {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string | null;
}) {
  for (const field of [
    'subjectTemplate',
    'htmlTemplate',
    'textTemplate'
  ] as const) {
    const source = template[field];
    if (!source) continue;
    try {
      const inspect = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;
        if (
          'type' in node &&
          [
            'PartialStatement',
            'PartialBlockStatement',
            'Decorator',
            'DecoratorBlock'
          ].includes(String(node.type))
        )
          throw new Error('Partials and decorators are not supported.');
        if (
          'type' in node &&
          node.type === 'MustacheStatement' &&
          'escaped' in node &&
          node.escaped === false
        )
          throw new Error(
            'Raw HTML variables are not supported. Use escaped variables.'
          );
        for (const child of Object.values(node)) {
          if (Array.isArray(child)) child.forEach(inspect);
          else inspect(child);
        }
      };
      inspect(engine.parse(source));
      engine.precompile(source, compileOptions);
    } catch (error) {
      throw new EmailTemplateError(
        'invalid_template',
        `${field}: ${error instanceof Error ? error.message : 'Invalid Handlebars'}`
      );
    }
  }
}

const previewSchema = z
  .object({
    template: emailTemplateSchema,
    sample: z.record(z.unknown())
  })
  .strict();

function validateSample(value: unknown, depth = 0, count = { nodes: 0 }): void {
  if (depth > 12 || ++count.nodes > 5000)
    throw new EmailTemplateError('invalid_sample');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new EmailTemplateError('invalid_sample');
    validateSample(child, depth + 1, count);
  }
}

function renderSource(source: string, data: unknown, plain = false) {
  try {
    let iterations = 0;
    let expandedLength = 0;
    const each = function (
      this: unknown,
      context: unknown,
      options: Handlebars.HelperOptions
    ) {
      const fn = options.fn;
      return engine.helpers.each.call(this, context, {
        ...options,
        fn: (value: unknown, runtime?: Handlebars.RuntimeOptions) => {
          if (++iterations > 10000)
            throw new EmailTemplateError('preview_too_large');
          const output = fn(value, runtime);
          expandedLength += output.length;
          if (expandedLength > 500000)
            throw new EmailTemplateError('preview_too_large');
          return output;
        }
      });
    };
    const output = engine.compile(source, {
      ...compileOptions,
      noEscape: plain
    })(data, {
      helpers: { each },
      allowProtoMethodsByDefault: false,
      allowProtoPropertiesByDefault: false
    });
    if (output.length > 500000)
      throw new EmailTemplateError('preview_too_large');
    return output;
  } catch (error) {
    if (error instanceof EmailTemplateError) throw error;
    throw new EmailTemplateError(
      'invalid_sample',
      error instanceof Error ? error.message : 'Rendering failed'
    );
  }
}

function renderSubject(source: string, data: unknown) {
  const subject = renderSource(source, data, true);
  if (/[\r\n]/.test(subject))
    throw new EmailTemplateError(
      'invalid_sample',
      'Subject must not contain newlines.'
    );
  return subject;
}

/** Renders a stored template for delivery. HTML is not sanitized: the template is admin-authored and variables are escaped. */
export function renderEmailTemplate(
  template: {
    subjectTemplate: string;
    htmlTemplate: string;
    textTemplate: string | null;
  },
  data: unknown
) {
  validateEmailTemplateSyntax(template);
  return {
    subject: renderSubject(template.subjectTemplate, data),
    html: renderSource(template.htmlTemplate, data),
    text: template.textTemplate
      ? renderSource(template.textTemplate, data, true)
      : undefined
  };
}

export function renderEmailTemplatePreview(input: unknown) {
  const { template, sample } = previewSchema.parse(input);
  validateEmailTemplateSyntax(template);
  validateSample(sample);
  const subject = renderSubject(template.subjectTemplate, sample);
  const html = sanitizeHtml(renderSource(template.htmlTemplate, sample), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'font',
      'center'
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'width', 'height', 'role'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      td: ['colspan', 'rowspan', 'style', 'align', 'width', 'height'],
      th: ['colspan', 'rowspan', 'style', 'align', 'width', 'height'],
      table: ['cellpadding', 'cellspacing', 'border', 'style', 'width', 'role']
    },
    allowedSchemes: ['https'],
    allowProtocolRelative: false,
    parseStyleAttributes: false
  });
  return {
    subject,
    html: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"></head><body>${html}</body></html>`,
    text: template.textTemplate
      ? renderSource(template.textTemplate, sample, true)
      : null
  };
}
