const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve('chatcut-playable');
const INDEX = path.join(ROOT, 'index.html');
const PORT = 4174;
const PAGE_URL = `http://127.0.0.1:${PORT}/?runtime-qa=1`;
const PRODUCTION_URL = 'https://chatcut.io/?runtime-qa-baseline=1';

function type(file) {
  if (/\.html$/i.test(file)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(file)) return 'text/css; charset=utf-8';
  if (/\.m?js$/i.test(file)) return 'text/javascript; charset=utf-8';
  if (/\.svg$/i.test(file)) return 'image/svg+xml';
  if (/\.png$/i.test(file)) return 'image/png';
  if (/\.webp$/i.test(file)) return 'image/webp';
  if (/\.jpe?g$/i.test(file)) return 'image/jpeg';
  if (/\.mp4$/i.test(file)) return 'video/mp4';
  if (/\.woff2?$/i.test(file)) return 'font/woff2';
  return 'application/octet-stream';
}

function disableIsland(html, index) {
  let cursor = -1;
  return html.replace(/<astro-island\b[^>]*>/gi, tag => {
    cursor += 1;
    if (cursor !== index) return tag;
    if (!/\ssr(?:=(?:""|'')?)?(?=\s|>)/i.test(tag)) return tag;
    return tag.replace(/\ssr(?:=(?:""|'')?)?(?=\s|>)/i, ' data-cc-disabled-ssr="1"');
  });
}

function server() {
  return http.createServer((req, res) => {
    const u = new globalThis.URL(req.url, PAGE_URL);
    let pathname;
    try { pathname = decodeURIComponent(u.pathname); } catch { pathname = u.pathname; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep) && file !== INDEX) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      if (file === INDEX && u.searchParams.has('disable-island')) {
        const index = Number(u.searchParams.get('disable-island'));
        data = Buffer.from(disableIsland(data.toString('utf8'), index));
      }
      res.writeHead(200, { 'content-type': type(file), 'cache-control': 'no-store' });
      res.end(data);
    });
  });
}

function relevant(messages) {
  return messages.filter(x => !/ResizeObserver loop/i.test(x));
}

function signature(message) {
  const react = message.match(/Minified React error #(\d+).*?(?:args%5B%5D|args\[\])=([^&\s]+)/i);
  if (react) return `react-${react[1]}-${decodeURIComponent(react[2] || '')}`;
  const reactOnly = message.match(/Minified React error #(\d+)/i);
  if (reactOnly) return `react-${reactOnly[1]}`;
  return message.replace(/https?:\/\/[^\s)]+/g, '<url>').slice(0, 240);
}

function islandMetadata() {
  const html = fs.readFileSync(INDEX, 'utf8');
  return Array.from(html.matchAll(/<astro-island\b[^>]*>/gi)).map((match, index) => {
    const tag = match[0];
    const componentUrl = tag.match(/component-url=(?:"([^"]+)"|'([^']+)')/i);
    const componentExport = tag.match(/component-export=(?:"([^"]+)"|'([^']+)')/i);
    const client = tag.match(/client=(?:"([^"]+)"|'([^']+)')/i);
    return {
      index,
      componentUrl: componentUrl?.[1] || componentUrl?.[2] || null,
      componentExport: componentExport?.[1] || componentExport?.[2] || null,
      client: client?.[1] || client?.[2] || null,
    };
  });
}

async function collectErrors(browser, url, waitMs = 1400) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(waitMs);
  } finally {
    await page.close();
  }
  return relevant(errors);
}

(async () => {
  const s = server();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(PORT, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ headless: true });

  try {
    const baselineRelevant = await collectErrors(browser, PRODUCTION_URL, 1800);
    const baselineSignatures = new Set(baselineRelevant.map(signature));

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const failed = [];
    page.on('pageerror', e => errors.push(String(e?.message || e)));
    page.on('requestfailed', req => {
      const url = req.url();
      if (url.includes('/_astro/')) failed.push(`${req.failure()?.errorText || 'failed'} ${url}`);
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
      const captionsVideo = page.locator('#transcript-captions [data-tc-part="captions"] #tc-video');
      await next.waitFor({ state: 'visible', timeout: 10000 });
      await captionsVideo.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(350);
      const captionsInitiallyPaused = await captionsVideo.evaluate(video => video.paused && video.currentTime < 0.1);
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
      const captionsPlayingAfterAction = await captionsVideo.evaluate(video => !video.paused);
      const captionsState = await page.evaluate(() => window.__chatcutDemoSession?.captions);
      const captionsGated = captionsInitiallyPaused && captionsPlayingAfterAction && captionsState === 'playing';

      const localRelevant = relevant(errors);
      const localOnlyErrors = localRelevant.filter(message => !baselineSignatures.has(signature(message)));
      let hydrationIsolation = [];
      if (localOnlyErrors.some(message => /Minified React error #418/i.test(message))) {
        const islands = islandMetadata();
        for (const island of islands) {
          const isolatedErrors = await collectErrors(browser, `http://127.0.0.1:${PORT}/?disable-island=${island.index}`, 1200);
          hydrationIsolation.push({
            ...island,
            errors: isolatedErrors.map(signature),
            removes418: !isolatedErrors.some(message => /Minified React error #418/i.test(message)),
          });
        }
      }

      const result = {
        localizedCount,
        astroIslands,
        captionsChanged,
        captionsInitiallyPaused,
        captionsPlayingAfterAction,
        captionsState,
        captionsGated,
        productionBaselineErrors: baselineRelevant,
        pageErrors: localRelevant,
        localOnlyErrors,
        failedAssetRequests: failed,
        hydrationIsolation,
      };
      const failures = [];
      if (!(localizedCount > 0)) failures.push('runtime-not-localized');
      if (localOnlyErrors.length) failures.push('local-only-page-errors');
      if (failed.length) failures.push('asset-request-failures');
      if (!captionsChanged) failures.push('captions-native-control');
      if (!captionsGated) failures.push('captions-click-gate');
      console.log(JSON.stringify({ ...result, failures }, null, 2));
      if (failures.length) process.exitCode = 1;
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => s.close(resolve));
  }
})().catch(err => { console.error(err?.stack || err); process.exit(1); });
