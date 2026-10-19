import { build } from 'esbuild';
import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: {
    contents: `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { NextIntlClientProvider } from 'next-intl';
      import messages from './messages/en.json';
      import { SuppliersTable } from './app/(dashboard)/suppliers/suppliers-table';
      const supplier = { id: 'fixture', code: 'FIXTURE', name: 'Fixture supplier', contactName: null,
        email: null, phone: null, website: null, country: null, region: null, notes: null,
        paymentTerms: null, leadTimeDays: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
        _count: { costPrices: 0, purchaseOrders: 0 } };
      createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
        <SuppliersTable initialSuppliers={[supplier]} initialIntegrationId="fixture" />
      </NextIntlClientProvider>);`,
    resolveDir: process.cwd(), loader: 'tsx'
  },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic',
  alias: { '@': process.cwd() },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-navigation', setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter = () => ({ refresh() {} });' }));
  } }]
});
const loginHtml = await (await fetch('http://localhost:3018/login')).text();
const stylesheets = Array.from(loginHtml.matchAll(/href="([^"]+\.css[^\"]*)"/g), match => match[1]);
assert.ok(stylesheets.length, 'The preview server must provide application styles');
const css = (await Promise.all(stylesheets.map(async path => (await fetch(new URL(path.replaceAll('&amp;', '&'), 'http://localhost:3018'))).text()))).join('\n');
const server = createServer((request, response) => {
  if (request.url === '/bundle.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(bundle.outputFiles[0].text); }
  else if (request.url === '/style.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/bundle.js"></script></body></html>'); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    let stored = null;
    let revision = 0;
    let conflict = false;
    let writes = 0;
    await page.route('**/api/suppliers/fixture/integration', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { integration: stored, configVersion: revision || null } });
      writes++;
      const body = route.request().postDataJSON();
      if (conflict) { conflict = false; return route.fulfill({ status: 409, json: { error: 'integration_conflict' } }); }
      if (body.isEnabled) return route.fulfill({ status: 400, json: { error: 'invalid_request', fields: ['config', 'sessionSecretRef'] } });
      revision++;
      stored = { ...body, updatedAt: `2026-10-18T00:00:0${revision}.000Z` };
      return route.fulfill({ json: { integration: stored, configVersion: revision } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/suppliers?integration=fixture`);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Base URL').waitFor();
    await dialog.getByLabel('Adapter', { exact: true }).selectOption('lanae');
    await dialog.getByLabel('Session environment reference').fill('SUPPLIER_LANAE_SESSION');
    assert.equal(await dialog.getByLabel('Session environment reference').evaluate(element => element.type), 'text');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByText('Integration saved.').waitFor();
    assert.equal(stored.isEnabled, false);
    assert.equal(stored.integrationVerifiedAt, null);
    await page.reload();
    await dialog.getByLabel('Session environment reference').waitFor();
    assert.equal(await dialog.getByLabel('Session environment reference').inputValue(), 'SUPPLIER_LANAE_SESSION');
    await dialog.getByLabel('Enabled', { exact: true }).check();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Check the highlighted fields' }).waitFor();
    await dialog.getByLabel('Enabled', { exact: true }).uncheck();
    await dialog.getByText('Advanced configuration', { exact: true }).click();
    await dialog.getByLabel('Verification and catalog JSON').fill('{');
    const beforeJson = writes;
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByText('Enter valid JSON before saving.').waitFor();
    assert.equal(writes, beforeJson);
    await dialog.getByLabel('Verification and catalog JSON').fill('{}');
    await dialog.getByLabel('Username environment reference').fill('SUPPLIER_LANAE_USERNAME');
    conflict = true;
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Another operator changed' }).waitFor();
    page.once('dialog', prompt => prompt.dismiss());
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await dialog.count(), 1);
    page.once('dialog', prompt => prompt.accept());
    await dialog.getByRole('button', { name: 'Reload', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#integration-usernameSecretRef')?.value === '');
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    await page.screenshot({ path: `/tmp/supplier-integration-${name}.png` });
    await dialog.getByLabel('Username environment reference').fill('SUPPLIER_LANAE_USERNAME');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByText('Integration saved.').waitFor();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#integration-usernameSecretRef')?.value === 'SUPPLIER_LANAE_USERNAME');
    assert.deepEqual(failures, []);
    console.log(`${name}: draft create/edit, enabled rejection, JSON errors, stale conflict, unsaved cancel, reload, reference-only fields and viewport bounds passed`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}