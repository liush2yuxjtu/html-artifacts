const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve('chatcut-playable');
const PORT = 4174;
const PAGE_URL = `http://127.0.0.1:${PORT}/?runtime-qa=1`;

function type(file) {
  if (/\.html$/i.test(file)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(file)) return 'text/css; charset=utf-8';
  if (/\.m?js$/i.test(file)) return 'text/javascript; charset=utf-8';
  if (/\.svg$/i.test(file)) return 'image/svg+xml';
  if (/\.png$/i.test(file)) return 'image/png';
  if (/\.webp$/i.test(file)) return 'image/webp';
  if (/\.jpe?g$/i.test(file)) return 'image/jpeg';
  if (/\.mp4$/i.test(file)) return 'video/mp4';
  if (/\.woff2$/i.test(file)) return 'font/woff2';
  return 'application/octet-stream';
}

function server() {
  return http.createServer((req, res) => {
    const u = new globalThis.URL(req.url, PAGE_URL);
    let pathname;
    try { pathname = decodeURIComponent(u.pathname); } catch { pathname = u.pathname; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      res.writeHead(200, { 'content-type': type(file), 'cache-control': 'no-store' });
      res.end(data);
    });
  });
}

(async () => {
  const s = server();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(PORT, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failed = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  page.on('requestfailed', req => {
    const url = req.url();
    if (url.includes('/_astro/') && /\.m?js(?:\?|$)/.test(url)) failed.push(`${req.failure()?.errorText || 'failed'} ${url}`);
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1800);

    const localizedCount = Number(await page.locator('meta[name="cc-runtime-localized"]').getAttribute('content'));
    const astroIslands = await page.locator('astro-island').count();

    const captions = page.locator('#transcript-captions [data-tc-part="captions"]');
    await captions.scrollIntoViewIfNeeded();
    const next = page.locator('#tc-style-next');
    await next.waitFor({ state: 'visible', timeout: 10000 });
    const before = await page.evaluate(() => {
      const line = document.querySelector('#tc-cap-line');
      const root = document.querySelector('#transcript-captions [data-tc-part="captions"]');
      return JSON.stringify({ preset: line?.getAttribute('data-preset'), cls: line?.className, html: root?.innerHTML });
    });
    await next.click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => {
      const line = document.querySelector('#tc-cap-line');
      const root = document.querySelector('#transcript-captions [data-tc-part="captions"]');
      return JSON.stringify({ preset: line?.getAttribute('data-preset'), cls: line?.className, html: root?.innerHTML });
    });
    const captionsChanged = before !== after;

    const relevantErrors = errors.filter(x => !/ResizeObserver loop/i.test(x));
    const result = {
      localizedCount,
      astroIslands,
      captionsChanged,
      pageErrors: relevantErrors,
      failedAstroRequests: failed,
    };
    const failures = [];
    if (!(localizedCount > 0)) failures.push('runtime-not-localized');
    if (relevantErrors.length) failures.push('page-errors');
    if (failed.length) failures.push('astro-request-failures');
    if (!captionsChanged) failures.push('captions-native-control');
    console.log(JSON.stringify({ ...result, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise(resolve => s.close(resolve));
  }
})().catch(err => { console.error(err?.stack || err); process.exit(1); });
