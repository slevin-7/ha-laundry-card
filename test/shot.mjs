// test/shot.mjs — Screenshot + Klicktest der Karte. Aufruf: node test/shot.mjs <szenario> [theme] ["js im Seitenkontext"]
// playwright-core per PLAYWRIGHT_CORE (Pfad) oder npm; Chromium aus dem Playwright-Cache.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = process.env.BIN || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const [scen = 'setup', theme = 'dark', js = ''] = process.argv.slice(2);
// kleiner Server, weil ES-Module und fetch() unter file:// blockiert werden
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ executablePath: BIN, headless: true });
const page = await browser.newPage({ viewport: { width: 452, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`http://localhost:${port}/test/harness.html?s=${scen}&theme=${theme}`);
await page.waitForTimeout(600);
if (js) { await page.evaluate(`(async () => { ${js} })()`); await page.waitForTimeout(400); }
const out = path.join(root, 'test', `shot_${scen}_${theme}.png`);
await page.locator('waschkueche-card').screenshot({ path: out });
const text = await page.evaluate(() => document.getElementById('card').shadowRoot.querySelector('.card')?.innerText.replace(/\s+/g, ' ').trim());
console.log('TEXT:', text?.slice(0, 500));
console.log('CALLS:', await page.evaluate(() => window.calls));
console.log('ERRORS:', errors);
console.log('PNG:', out);
await browser.close(); srv.close();
process.exit(errors.length ? 1 : 0);
