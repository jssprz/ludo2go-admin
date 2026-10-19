import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';

const supplier = process.argv[2];
const urls = {
  asmodee: 'https://b2b.asmodee.cl/login',
  devir: 'https://btb.devir.cl/wp-login.php',
  lanae:
    'https://lanae.cl/customer_authentication/redirect?locale=es&region_country=CL'
};
if (!Object.hasOwn(urls, supplier)) {
  console.error('Usage: npm run supplier:login -- <asmodee|devir|lanae>');
  process.exitCode = 1;
} else {
  let browser;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(urls[supplier], { waitUntil: 'domcontentloaded' });
    await prompt.question(
      'Complete login and any verification in the browser. Open an account-priced product, then press Enter here. '
    );
    const host = new URL(urls[supplier]).hostname;
    if (new URL(page.url()).hostname !== host)
      throw new Error('not_on_supplier_site');
    const state = await context.storageState();
    const cookies = state.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, '');
      return host === domain || host.endsWith(`.${domain}`);
    });
    if (!cookies.length) throw new Error('no_supplier_session');
    const directory = resolve('.supplier-sessions');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const output = resolve(directory, `${supplier}-${Date.now()}.json`);
    await writeFile(output, JSON.stringify({ cookies }), {
      mode: 0o600,
      flag: 'wx'
    });
    console.log(`Session saved to ${output}`);
    console.log(
      'Treat this file as a password. Store its contents in the supplier session Vercel environment variable through the Vercel dashboard; never paste it into chat or commit it.'
    );
  } catch {
    console.error(
      'Session capture failed. Complete login on the supplier domain and retry. No secret values were logged.'
    );
    process.exitCode = 1;
  } finally {
    prompt.close();
    await browser?.close();
  }
}
