import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { blockAnchor } from './guide-blocks';

export function isGuideBlockId(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

export function safeGuideUrl(value: unknown, kind: 'link' | 'image' = 'link'): string | undefined {
  if (typeof value !== 'string' || !value || value !== value.trim()) return undefined;
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return undefined; }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return undefined;
  if (value.startsWith('#')) {
    const id = value.slice('#block-'.length);
    return kind === 'link' && isGuideBlockId(id) && value === `#${blockAnchor(id)}` ? value : undefined;
  }
  if (value.startsWith('/')) return !decoded.startsWith('//') && !decoded.startsWith('/\\') ? value : undefined;
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : undefined;
  } catch { return undefined; }
}

export function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['h2', 'h3', 'p', 'a', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'br', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img', 'pre', 'code'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      ol: ['start'],
      th: ['colspan', 'rowspan', 'style', 'align'],
      td: ['colspan', 'rowspan', 'style', 'align'],
      h2: ['style', 'align'],
      h3: ['style', 'align'],
      p: ['style', 'align']
    },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    transformTags: {
      '*': (tagName, attributes) => {
        const attribs = { ...attributes };
        if (tagName === 'a') {
          const href = safeGuideUrl(attribs.href);
          if (href) attribs.href = href; else delete attribs.href;
          if (attribs.target === '_blank') attribs.rel = 'noopener noreferrer'; else delete attribs.target;
        }
        if (tagName === 'img') {
          const src = safeGuideUrl(attribs.src, 'image');
          if (src) attribs.src = src; else delete attribs.src;
        }
        if (attribs.align && !['left', 'center', 'right', 'justify'].includes(attribs.align)) delete attribs.align;
        for (const key of ['colspan', 'rowspan', 'start']) {
          if (attribs[key] && !/^[1-9]\d{0,2}$/.test(attribs[key])) delete attribs[key];
        }
        return { tagName, attribs };
      }
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src
  });
}