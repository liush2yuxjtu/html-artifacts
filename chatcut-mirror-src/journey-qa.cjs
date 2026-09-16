const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve('chatcut-playable');
const PORT = 4175;
const LOCAL = `http://127.0.0.1:${PORT}/?journey-qa=1`;
const LIVE = 'https://chatcut.io/?journey-qa-baseline=1';
const TARGETS = [
  '#best-moments',
  '#motion-graphics',
  '#transcript-captions [data-tc-part="edit"]',
  '#transcript-captions [data-tc-part="captions"]',
  '#image-to-video .itv-story:not(.itv-story-video)',
  '#image-to-video .itv-story-video',
  '#music-generation',
  '#pricing',
];

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

function server() {
  return http.createServer((req, res) => {
    const u = new URL(req.url, LOCAL);
    let pathname = decodeURIComponent(u.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
      return res.writeHead(403).end('Forbidden');
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404, { 'content-type':'text/plain' }).end('Not found');
      res.writeHead(200, { 'content-type':type(file), 'cache-control':'no-store' });
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

async function scrollJourney(browser, url, local = false) {
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  page.on('requestfailed', req => {
    if (local && req.url().includes('/_astro/')) {
      failedAssets.push(`${req.failure()?.errorText || 'failed'} ${req.url()}`);
    }
  });
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.locator('h1').first().waitFor({ state:'visible', timeout:30000 });
    await page.waitForTimeout(900);
    for (const selector of TARGETS) {
      const exists = await page.locator(selector).first().count();
      if (!exists) continue;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await page.evaluate(sel => {
            document.querySelector(sel)?.scrollIntoView({ block:'center', inline:'nearest' });
          }, selector);
          break;
        } catch {}
      }
      await page.waitForTimeout(850);
    }
    await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
    await page.waitForTimeout(500);
    return { errors: relevant(errors), failedAssets };
  } finally {
    await page.close();
  }
}

(async () => {
  const s = server();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(PORT, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ headless:true });
  try {
    const live = await scrollJourney(browser, LIVE, false);
    const local = await scrollJourney(browser, LOCAL, true);
    const baseline = new Set(live.errors.map(signature));
    const localOnlyErrors = local.errors.filter(error => !baseline.has(signature(error)));
    const failures = [];
    if (localOnlyErrors.length) failures.push('local-only-journey-errors');
    if (local.failedAssets.length) failures.push('local-astro-request-failures');
    console.log(JSON.stringify({
      productionErrors: live.errors,
      localErrors: local.errors,
      localOnlyErrors,
      localFailedAstroRequests: local.failedAssets,
      failures,
    }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise(resolve => s.close(resolve));
  }
})().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
