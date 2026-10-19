import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import type { SupplierKind } from './supplier-catalog';
import { parseClp } from './supplier-catalog';

const envReference = z.string().regex(/^SUPPLIER_[A-Z0-9_]+$/);
export const integrationSchema = z.object({
  kind: z.enum(['asmodee', 'devir', 'lanae']),
  baseUrl: z.string().url(),
  secrets: z.object({
    username: envReference.optional(),
    password: envReference.optional(),
    session: envReference.optional(),
    browser: envReference.optional()
  }),
  auth: z.enum(['form', 'asmodee_api', 'browser_session']),
  browserRendering: z.boolean().default(false),
  verification: z.object({
    path: z.string(),
    accountSelector: z.string().min(1),
    account: z
      .object({
        path: z.string(),
        expectedIdentity: z.string().min(1),
        identityPath: z.string().optional(),
        identitySelector: z.string().optional()
      })
      .refine(
        (value) =>
          Boolean(value.identityPath) !== Boolean(value.identitySelector)
      ),
    priceSelector: z.string().min(1),
    priceEvidence: z.literal('account_purchase_price'),
    verifiedAt: z.string().datetime(),
    structuredPricePath: z.string().optional()
  }),
  catalog: z.object({
    paths: z.array(z.string()).min(1).max(50),
    productSelector: z.string().default('li.product'),
    nextSelector: z.string().default('a.next.page-numbers, a[rel="next"]'),
    terminalSelector: z.string().min(1),
    priceSelector: z.string().min(1),
    inStockSelector: z.string().min(1),
    outOfStockSelector: z.string().min(1),
    expectedMinimum: z.number().int().positive(),
    maxPages: z.number().int().min(1).max(150).default(50),
    structured: z
      .object({
        itemsPath: z.string(),
        nextPath: z.string(),
        totalPath: z.string(),
        id: z.string(),
        name: z.string(),
        sku: z.string(),
        barcode: z.string(),
        url: z.string(),
        categories: z.string(),
        availability: z.string(),
        inStockValue: z.union([z.string(), z.boolean(), z.number()]),
        outOfStockValue: z.union([z.string(), z.boolean(), z.number()]),
        purchasePrice: z.string(),
        packQuantity: z.string(),
        edition: z.string(),
        language: z.string(),
        expansion: z.string(),
        paginationVerifiedAt: z.string().datetime()
      })
      .optional()
  }),
  taxVerifiedAt: z.string().datetime().optional()
});
export type SupplierIntegration = z.infer<typeof integrationSchema>;
export const integrationMarker = '[opportunities-integration]';
export const integrationEndMarker = '[/opportunities-integration]';

export function readIntegration(
  notes: string | null
): SupplierIntegration | null {
  if (!notes?.includes(integrationMarker)) return null;
  try {
    const raw = notes
      .split(integrationMarker)[1]
      .split(integrationEndMarker)[0];
    const config = integrationSchema.parse(JSON.parse(raw));
    const expected: Record<SupplierKind, string> = {
      asmodee: 'https://b2b.asmodee.cl',
      devir: 'https://btb.devir.cl',
      lanae: 'https://lanae.cl'
    };
    if (new URL(config.baseUrl).origin !== expected[config.kind]) return null;
    if (config.auth === 'form' && config.kind !== 'devir') return null;
    if (config.auth === 'asmodee_api' && config.kind !== 'asmodee') return null;
    return config;
  } catch {
    return null;
  }
}

export class SupplierError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export interface SecretProvider {
  read(reference: string): Promise<string>;
}

export const vercelSecrets: SecretProvider = {
  async read(reference) {
    if (typeof window !== 'undefined') throw new SupplierError('server_only');
    if (!envReference.safeParse(reference).success)
      throw new SupplierError('invalid_secret_reference');
    const value = process.env[reference];
    if (!value) throw new SupplierError('secret_not_configured');
    return value;
  }
};

const browserState = z.object({
  cookies: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        domain: z.string(),
        path: z.string(),
        expires: z.number(),
        secure: z.boolean(),
        httpOnly: z.boolean(),
        sameSite: z.enum(['Strict', 'Lax', 'None']).optional()
      })
    )
    .max(300)
});

export class SupplierSession {
  private jar = new CookieJar();
  private bearer: string | null = null;
  constructor(
    readonly config: SupplierIntegration,
    private readonly secrets: SecretProvider = vercelSecrets,
    private readonly transport: typeof fetch = fetch
  ) {}

  url(path: string) {
    const url = new URL(path, this.config.baseUrl);
    const allowed =
      url.origin === new URL(this.config.baseUrl).origin ||
      (this.config.kind === 'asmodee' &&
        url.origin === 'https://b2b-back.asmodee.cl');
    if (!allowed || url.username || url.password) {
      throw new SupplierError('supplier_origin_rejected');
    }
    return url;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    let url = this.url(path);
    let options = init;
    try {
      for (let redirects = 0; redirects < 6; redirects++) {
        const headers = new Headers(options.headers);
        headers.set('Cookie', await this.jar.getCookieString(url.href));
        headers.set('User-Agent', 'Jobys-Supplier-Catalog/1.0');
        if (
          this.config.kind === 'asmodee' &&
          url.origin === 'https://b2b-back.asmodee.cl' &&
          this.bearer
        ) {
          headers.set('Authorization', `Bearer ${this.bearer}`);
          headers.set('X-Logged-As-Employee', '0');
        }
        const response = await this.transport(url, {
          ...options,
          headers,
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(20000)
        });
        for (const cookie of response.headers.getSetCookie())
          await this.jar.setCookie(cookie, url.href);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) throw new SupplierError('invalid_redirect');
          url = this.url(new URL(location, url).href);
          if (
            response.status === 303 ||
            ((response.status === 301 || response.status === 302) &&
              options.method === 'POST')
          ) {
            options = { method: 'GET' };
          }
          continue;
        }
        if ([401, 403].includes(response.status))
          throw new SupplierError('session_expired');
        if (!response.ok) throw new SupplierError('supplier_request_failed');
        return response;
      }
      throw new SupplierError('too_many_redirects');
    } catch (error) {
      if (error instanceof SupplierError) throw error;
      throw new SupplierError('supplier_request_failed');
    }
  }

  async authenticate() {
    this.jar = new CookieJar();
    this.bearer = null;
    if (this.config.auth === 'asmodee_api') {
      if (!this.config.secrets.username || !this.config.secrets.password)
        throw new SupplierError('secret_not_configured');
      try {
        const response = await this.request(
          'https://b2b-back.asmodee.cl/api/login',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              email: await this.secrets.read(this.config.secrets.username),
              password: await this.secrets.read(this.config.secrets.password),
              is_employee: 0
            })
          }
        );
        const body = await response.json();
        if (typeof body.plain_text_token !== 'string' || !body.plain_text_token)
          throw new SupplierError('authentication_failed');
        this.bearer = body.plain_text_token;
        await this.request('https://b2b-back.asmodee.cl/api/auth');
      } catch {
        throw new SupplierError('authentication_failed');
      }
      await this.verify();
      return;
    }
    if (this.config.auth === 'browser_session') {
      if (!this.config.secrets.session)
        throw new SupplierError('interactive_login_required');
      let state: z.infer<typeof browserState>;
      try {
        state = browserState.parse(
          JSON.parse(await this.secrets.read(this.config.secrets.session))
        );
      } catch {
        throw new SupplierError('browser_session_invalid_or_missing');
      }
      const host = new URL(this.config.baseUrl).hostname;
      for (const cookie of state.cookies) {
        const domain = cookie.domain.replace(/^\./, '');
        if (host !== domain && !host.endsWith(`.${domain}`)) continue;
        if (cookie.expires > 0 && cookie.expires * 1000 <= Date.now()) continue;
        const expires =
          cookie.expires > 0
            ? `; Expires=${new Date(cookie.expires * 1000).toUTCString()}`
            : '';
        await this.jar.setCookie(
          `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}${expires}${cookie.secure ? '; Secure' : ''}${cookie.httpOnly ? '; HttpOnly' : ''}`,
          this.config.baseUrl
        );
      }
    } else {
      if (!this.config.secrets.username || !this.config.secrets.password)
        throw new SupplierError('secret_not_configured');
      const html = await (await this.request('/wp-login.php')).text();
      const $ = cheerio.load(html);
      const form = $('form')
        .filter(
          (_, node) =>
            $(node).find('input[name="log"], input[name="pwd"]').length === 2
        )
        .first();
      if (!form.length) throw new SupplierError('interactive_login_required');
      const fields = new URLSearchParams();
      form.find('input[type="hidden"]').each((_, node) => {
        const name = $(node).attr('name');
        if (name) fields.set(name, $(node).attr('value') ?? '');
      });
      fields.set('log', await this.secrets.read(this.config.secrets.username));
      fields.set('pwd', await this.secrets.read(this.config.secrets.password));
      fields.set('redirect_to', this.url(this.config.verification.path).href);
      await this.request(form.attr('action') || '/wp-login.php', {
        method: 'POST',
        body: fields,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: this.url('/').origin,
          Referer: this.url('/wp-login.php').href
        }
      });
    }
    await this.verify();
  }

  async verify() {
    const account = this.config.verification.account;
    const accountResponse = await this.request(account.path);
    let identity: unknown;
    if (account.identityPath) {
      const payload: unknown = await accountResponse.json();
      identity = account.identityPath
        .split('.')
        .reduce<unknown>(
          (current, key) =>
            current && typeof current === 'object'
              ? (current as Record<string, unknown>)[key]
              : undefined,
          payload
        );
    } else {
      identity = cheerio
        .load(await accountResponse.text())(account.identitySelector!)
        .first()
        .text()
        .trim();
    }
    if (
      (typeof identity !== 'string' && typeof identity !== 'number') ||
      String(identity) !== account.expectedIdentity
    ) {
      throw new SupplierError('session_expired');
    }
    const response = await this.request(this.config.verification.path);
    if (this.config.verification.structuredPricePath) {
      const payload: unknown = await response.json();
      const value = this.config.verification.structuredPricePath
        .split('.')
        .reduce<unknown>(
          (current, key) =>
            current && typeof current === 'object'
              ? (current as Record<string, unknown>)[key]
              : undefined,
          payload
        );
      if (
        parseClp(
          typeof value === 'string' || typeof value === 'number' ? value : null
        ) === null
      ) {
        throw new SupplierError('account_prices_not_verified');
      }
      return;
    }
    let html = await response.text();
    if (
      this.config.kind === 'lanae' &&
      this.config.browserRendering &&
      !cheerio
        .load(html)(this.config.verification.priceSelector)
        .text()
        .match(/\d/)
    ) {
      html = await this.render(
        this.config.verification.path,
        this.config.verification.priceSelector
      );
    }
    const $ = cheerio.load(html);
    if (
      !$(this.config.verification.accountSelector).length ||
      !$(this.config.verification.priceSelector).text().match(/\d/)
    ) {
      throw new SupplierError('account_prices_not_verified');
    }
  }

  async render(path: string, priceSelector: string) {
    if (!this.config.secrets.browser)
      throw new SupplierError('browser_renderer_not_configured');
    const url = this.url(path);
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.connectOverCDP(
        await this.secrets.read(this.config.secrets.browser),
        { timeout: 20000 }
      );
      try {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        try {
          const cookies = await this.jar.getCookies(this.config.baseUrl);
          await context.addCookies(
            cookies.map((cookie) => ({
              name: cookie.key,
              value: cookie.value,
              domain: cookie.domain ?? url.hostname,
              path: cookie.path ?? '/',
              secure: cookie.secure ?? true,
              httpOnly: cookie.httpOnly ?? false
            }))
          );
          const page = await context.newPage();
          await page.route('**/*', (route) => {
            if (
              route.request().isNavigationRequest() &&
              route.request().frame() === page.mainFrame() &&
              new URL(route.request().url()).origin !== url.origin
            )
              return route.abort();
            return route.continue();
          });
          await page.goto(url.href, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          await page
            .locator(priceSelector)
            .filter({ hasText: /\d/ })
            .first()
            .waitFor({ timeout: 15000 });
          return await page.content();
        } finally {
          await context.close();
        }
      } finally {
        await browser.close();
      }
    } catch {
      throw new SupplierError('authenticated_browser_render_failed');
    }
  }
}
