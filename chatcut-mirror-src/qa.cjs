const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve('chatcut-playable');
const PORT = 4173;
const LOCAL_URL = `http://127.0.0.1:${PORT}/?qa=1`;

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, LOCAL_URL);
    let requestPath = decodeURIComponent(url.pathname);
    if (requestPath === '/') requestPath = '/index.html';
    const file = path.resolve(ROOT, '.' + requestPath);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
      res.end(data);
    });
  });
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible()) {
      await item.click();
      return;
    }
  }
  throw new Error('No visible click target found');
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) throw new Error('Missing generated chatcut-playable/index.html');

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));

  const report = {
    version: null,
    publicShape: false,
    expert: false,
    motion: false,
    transcript: false,
    image: false,
    video: false,
    music: false,
    captionsUntouched: false,
    stayedLocal: true,
    pageErrors: [],
  };

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 });
    const headline = (await page.locator('h1').first().innerText()).trim();
    report.publicShape = /AI Video Editor|Edit videos by telling AI what you want/i.test(headline);

    await page.waitForFunction(() => document.documentElement.dataset.ccPlayableVersion === '2', null, { timeout: 15000 });
    report.version = await page.evaluate(() => document.documentElement.dataset.ccPlayableVersion);

    const expert = page.locator('#best-moments');
    await expert.scrollIntoViewIfNeeded();
    await page.locator('#best-moments .cc-expert-send').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#best-moments .cc-expert-send').click();
    await page.waitForFunction(() => document.querySelector('#best-moments [data-cc-status="expert"]')?.textContent.trim() === 'Done · first cut updated', null, { timeout: 8000 });
    report.expert = (await page.locator('#best-moments [data-cc-status="expert"]').innerText()).trim() === 'Done · first cut updated';

    const motion = page.locator('#motion-graphics');
    await motion.scrollIntoViewIfNeeded();
    await clickFirstVisible(page.locator('#motion-graphics [aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#motion-graphics [data-cc-status="motion"]')?.textContent.trim() === 'Generated · editable motion graphics ready', null, { timeout: 8000 });
    report.motion = await motion.evaluate(el => el.classList.contains('cc-motion-generated'));

    const transcript = page.locator('#transcript-captions [data-tc-part="edit"]');
    await transcript.scrollIntoViewIfNeeded();
    await page.locator('#tc-edit-send').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#tc-edit-send').click();
    await page.waitForFunction(() => document.querySelector('#tc-edit-status')?.textContent.trim().startsWith('Done —'), null, { timeout: 10000 });
    const fillerVisibleCount = await page.locator('#transcript-captions [data-tc-part="edit"] .tc-word[data-tc-filler="true"]:visible').count();
    const transcriptMeta = (await page.locator('#tc-edit-meta').innerText()).trim();
    report.transcript = fillerVisibleCount === 0 && transcriptMeta === '46 words · 0:31';

    const imageStory = page.locator('#image-to-video .itv-story:not(.itv-story-video)');
    await imageStory.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story:not(.itv-story-video)')?.classList.contains('cc-image-source'), null, { timeout: 10000 });
    const imageInitial = await imageStory.evaluate(root => {
      const img = root.querySelector('.itv-showcase-img');
      const showcase = root.querySelector('.itv-showcase');
      const pseudo = showcase ? getComputedStyle(showcase, '::after').content : '';
      return Boolean(img && !img.src.includes('cat-white-before') && pseudo.includes('Waiting to generate'));
    });
    await clickFirstVisible(imageStory.locator('.itv-send-btn,[aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story:not(.itv-story-video) [data-cc-status="image"]')?.textContent.trim() === 'Generated · ready to add to the edit', null, { timeout: 8000 });
    report.image = imageInitial && await imageStory.evaluate(el => el.classList.contains('cc-image-generated'));

    const videoStory = page.locator('#image-to-video .itv-story-video');
    await videoStory.scrollIntoViewIfNeeded();
    await page.locator('#image-to-video .itv-story-video .cc-video-reference-overlay').waitFor({ state: 'visible', timeout: 10000 });
    const initialReference = await page.locator('#image-to-video .itv-story-video .cc-video-reference-overlay').isVisible();
    await clickFirstVisible(videoStory.locator('.itv-send-btn,[aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story-video [data-cc-status="video"]')?.textContent.trim() === 'Generated · original preview video loaded', null, { timeout: 8000 });
    report.video = initialReference && await videoStory.evaluate(el => el.classList.contains('cc-video-generated')) && (await page.locator('#image-to-video .itv-story-video .cc-video-reference-overlay').count()) === 0;

    const music = page.locator('#music-generation');
    await music.scrollIntoViewIfNeeded();
    await page.locator('#music-generation .cc-music-prompt-bar').waitFor({ state: 'visible', timeout: 10000 });
    const silentInitial = (await page.locator('#music-generation .cc-music-state-pill').innerText()).trim() === 'Silent video';
    await page.locator('#music-generation .cc-music-send').click();
    await page.waitForFunction(() => document.querySelector('#music-generation .cc-music-state-pill')?.textContent.trim() === 'Music ready', null, { timeout: 8000 });
    await page.waitForTimeout(550);
    const boardOpacity = Number(await page.locator('#music-generation .tc-music-board').evaluate(el => getComputedStyle(el).opacity));
    report.music = silentInitial && boardOpacity > 0.95 && await music.evaluate(el => el.classList.contains('cc-music-generated'));

    const captions = page.locator('#transcript-captions [data-tc-part="captions"]');
    await captions.scrollIntoViewIfNeeded();
    const captionsNext = page.locator('#tc-style-next');
    await captionsNext.waitFor({ state: 'visible', timeout: 10000 });
    await captionsNext.click();
    await page.waitForTimeout(350);
    report.captionsUntouched = (await captionsNext.isVisible()) && !(await captions.getAttribute('data-cc-demo'));

    report.stayedLocal = new URL(page.url()).hostname === '127.0.0.1';
    report.pageErrors = pageErrors.filter(message => !/ResizeObserver loop/i.test(message));

    const required = ['publicShape','expert','motion','transcript','image','video','music','captionsUntouched','stayedLocal'];
    const failures = required.filter(key => !report[key]);
    console.log(JSON.stringify({ ...report, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
