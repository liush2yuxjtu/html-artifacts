const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve('chatcut-playable');
const SNAP_ROOT = path.resolve('chatcut-snapshots');
const PORT = 4173;
// The version build.mjs currently stamps; the QA must see exactly that build.
const PLAYABLE_VERSION = fs.readFileSync(path.join(__dirname, 'build.mjs'), 'utf8').match(/ccPlayableVersion = '(\d+)'/)[1];
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
  if (file.endsWith('.woff') || file.endsWith('.woff2')) return 'font/woff2';
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

async function settleLocator(page, locator, attempts = 6) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 12000 });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      const pending = await locator.evaluate(el => Boolean(el.closest('astro-island[ssr]')));
      if (pending) {
        await page.waitForTimeout(300);
        continue;
      }
      // Give Astro's post-hydration DOM commit and our overlay observer two frames.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForTimeout(120);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250 + attempt * 100);
    }
  }
  throw lastError || new Error('Unable to settle locator');
}

async function safeElementShot(page, locator, name, snapshotErrors) {
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await settleLocator(page, locator, 3);
      await locator.screenshot({ path: path.join(SNAP_ROOT, `${name}.png`), animations: 'disabled' });
      return true;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250 + attempt * 120);
    }
  }
  snapshotErrors.push(`${name}: ${String(lastError?.message || lastError || 'snapshot failed')}`);
  return false;
}

async function safeViewportShot(page, name, snapshotErrors) {
  try {
    await page.screenshot({ path: path.join(SNAP_ROOT, `${name}.png`), animations: 'disabled' });
    return true;
  } catch (error) {
    snapshotErrors.push(`${name}: ${String(error?.message || error)}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) throw new Error('Missing generated chatcut-playable/index.html');
  fs.rmSync(SNAP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(SNAP_ROOT, { recursive: true });

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  const snapshotErrors = [];
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
    captionsGated: false,
    mobile: false,
    mobileDiagnostics: null,
    stayedLocal: true,
    pageErrors: [],
    snapshotErrors,
  };

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(900);
    const headline = (await page.locator('h1').first().innerText()).trim();
    report.publicShape = /AI Video Editor|Edit videos by telling AI what you want/i.test(headline);
    await safeViewportShot(page, '01-hero', snapshotErrors);

    await page.waitForFunction(v => document.documentElement.dataset.ccPlayableVersion === v, PLAYABLE_VERSION, { timeout: 15000 });
    report.version = await page.evaluate(() => document.documentElement.dataset.ccPlayableVersion);

    const expert = page.locator('#best-moments');
    await settleLocator(page, expert);
    await page.locator('#best-moments .cc-expert-send').waitFor({ state: 'visible', timeout: 15000 });
    await safeElementShot(page, expert, '02-expert-before', snapshotErrors);
    await page.locator('#best-moments .cc-expert-send').click();
    await page.waitForFunction(() => document.querySelector('#best-moments [data-cc-status="expert"]')?.textContent.trim() === 'Done · first cut updated', null, { timeout: 8000 });
    report.expert = (await page.locator('#best-moments [data-cc-status="expert"]').innerText()).trim() === 'Done · first cut updated';
    await safeElementShot(page, expert, '03-expert-after', snapshotErrors);

    const motion = page.locator('#motion-graphics');
    await settleLocator(page, motion);
    await safeElementShot(page, motion, '04-motion-before', snapshotErrors);
    await clickFirstVisible(page.locator('#motion-graphics [aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#motion-graphics [data-cc-status="motion"]')?.textContent.trim() === 'Generated · editable motion graphics ready', null, { timeout: 8000 });
    report.motion = await motion.evaluate(el => el.classList.contains('cc-motion-generated'));
    await safeElementShot(page, motion, '05-motion-after', snapshotErrors);

    const transcript = page.locator('#transcript-captions [data-tc-part="edit"]');
    await settleLocator(page, transcript);
    await page.locator('#tc-edit-send').waitFor({ state: 'visible', timeout: 15000 });
    await safeElementShot(page, transcript, '06-transcript-before', snapshotErrors);
    await page.locator('#tc-edit-send').click();
    await page.waitForFunction(() => document.querySelector('#tc-edit-status')?.textContent.trim().startsWith('Done —'), null, { timeout: 10000 });
    const fillerVisibleCount = await page.locator('#transcript-captions [data-tc-part="edit"] .tc-word[data-tc-filler="true"]:visible').count();
    const transcriptMeta = (await page.locator('#tc-edit-meta').innerText()).trim();
    // The passive transcript animation keeps ticking; it must not undo the edit.
    await transcript.evaluate(el => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(2000);
    await transcript.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(2000);
    const fillerVisibleLater = await page.locator('#transcript-captions [data-tc-part="edit"] .tc-word[data-tc-filler="true"]:visible').count();
    const transcriptMetaLater = (await page.locator('#tc-edit-meta').innerText()).trim();
    report.transcriptHeld = fillerVisibleLater === 0 && transcriptMetaLater === transcriptMeta;
    report.transcript = fillerVisibleCount === 0 && transcriptMeta === '46 words · 0:31' && report.transcriptHeld;
    await safeElementShot(page, transcript, '07-transcript-after', snapshotErrors);

    const captions = page.locator('#transcript-captions [data-tc-part="captions"]');
    await settleLocator(page, captions);
    const captionsVideo = page.locator('#transcript-captions [data-tc-part="captions"] #tc-video');
    await captionsVideo.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(350);
    const captionsInitiallyPaused = await captionsVideo.evaluate(video => video.paused && video.currentTime < 0.1);
    await safeElementShot(page, captions, '08a-captions-before', snapshotErrors);
    const captionsNext = page.locator('#tc-style-next');
    await captionsNext.waitFor({ state: 'visible', timeout: 10000 });
    await captionsNext.click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#transcript-captions [data-tc-part="captions"] #tc-video');
      return Boolean(video && !video.paused);
    }, null, { timeout: 5000 });
    await page.waitForTimeout(800);
    await safeElementShot(page, captions, '08-captions-native', snapshotErrors);
    const captionsState = await page.evaluate(() => window.__chatcutDemoSession?.captions);
    report.captionsGated = captionsInitiallyPaused && captionsState === 'playing';

    const imageStory = page.locator('#image-to-video .itv-story:not(.itv-story-video)');
    await settleLocator(page, imageStory);
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story:not(.itv-story-video)')?.classList.contains('cc-image-source'), null, { timeout: 10000 });
    const imageInitial = await imageStory.evaluate(root => {
      const img = root.querySelector('.itv-showcase-img');
      const showcase = root.querySelector('.itv-showcase');
      const pseudo = showcase ? getComputedStyle(showcase, '::after').content : '';
      return Boolean(img && img.src.includes('cat-white-before') && pseudo.includes('Ready to generate'));
    });
    await safeElementShot(page, imageStory, '09-image-before', snapshotErrors);
    await clickFirstVisible(imageStory.locator('.itv-send-btn,[aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story:not(.itv-story-video) [data-cc-status="image"]')?.textContent.trim() === 'Generated · ready to add to the edit', null, { timeout: 8000 });
    report.image = imageInitial && await imageStory.evaluate(el => el.classList.contains('cc-image-generated'));
    await safeElementShot(page, imageStory, '10-image-after', snapshotErrors);

    const videoStory = page.locator('#image-to-video .itv-story-video');
    await settleLocator(page, videoStory);
    await page.waitForTimeout(300);
    const videoInitial = await videoStory.evaluate(root => {
      const visibleOptions = [...root.querySelectorAll('.itv-option-button')].filter(button => {
        const style = getComputedStyle(button);
        return !button.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      });
      const references = [...root.querySelectorAll('.itv-reference-card')].filter(el => {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      const video = root.querySelector('.itv-showcase-video');
      return {
        visibleOptions: visibleOptions.length,
        firstLabel: visibleOptions[0]?.getAttribute('aria-label') || '',
        references: references.length,
        overlayCount: root.querySelectorAll('.cc-video-reference-overlay').length,
        paused: Boolean(video?.paused),
      };
    });
    await safeElementShot(page, videoStory, '11-video-before', snapshotErrors);
    await clickFirstVisible(videoStory.locator('.itv-send-btn,[aria-label="Generate"]'));
    await page.waitForFunction(() => document.querySelector('#image-to-video .itv-story-video [data-cc-status="video"]')?.textContent.trim() === 'Generated · original preview video loaded', null, { timeout: 8000 });
    const videoAfter = await videoStory.evaluate(root => {
      const visibleOptions = [...root.querySelectorAll('.itv-option-button')].filter(button => {
        const style = getComputedStyle(button);
        return !button.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      });
      return {
        generated: root.classList.contains('cc-video-generated'),
        visibleOptions: visibleOptions.length,
        overlayCount: root.querySelectorAll('.cc-video-reference-overlay').length,
      };
    });
    report.video = videoInitial.visibleOptions === 1
      && /Comic to Live-Action Film/i.test(videoInitial.firstLabel)
      && videoInitial.references === 1
      && videoInitial.overlayCount === 0
      && videoInitial.paused
      && videoAfter.generated
      && videoAfter.visibleOptions === 1
      && videoAfter.overlayCount === 0;
    await safeElementShot(page, videoStory, '12-video-after', snapshotErrors);

    const music = page.locator('#music-generation');
    await settleLocator(page, music);
    await page.locator('#music-generation .cc-music-prompt-bar').waitFor({ state: 'visible', timeout: 10000 });
    const silentInitial = (await page.locator('#music-generation .cc-music-state-pill').innerText()).trim() === 'Silent video';
    await safeElementShot(page, music, '13-music-before', snapshotErrors);
    await page.locator('#music-generation .cc-music-send').click();
    await page.waitForFunction(() => document.querySelector('#music-generation .cc-music-state-pill')?.textContent.trim() === 'Music ready', null, { timeout: 8000 });
    await page.waitForTimeout(550);
    const boardOpacity = Number(await page.locator('#music-generation .tc-music-board').evaluate(el => getComputedStyle(el).opacity));
    report.music = silentInitial && boardOpacity > 0.95 && await music.evaluate(el => el.classList.contains('cc-music-generated'));
    await safeElementShot(page, music, '14-music-after', snapshotErrors);

    const pricing = page.locator('#pricing, section:has-text("Pricing")').first();
    if (await pricing.count()) await safeElementShot(page, pricing, '15-pricing', snapshotErrors);
    const footer = page.locator('footer').last();
    if (await footer.count()) await safeElementShot(page, footer, '16-footer', snapshotErrors);

    report.stayedLocal = new URL(page.url()).hostname === '127.0.0.1';
    report.pageErrors = pageErrors.filter(message => !/ResizeObserver loop/i.test(message));

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    try {
      await mobile.goto(LOCAL_URL + '&mobile=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await mobile.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 });
      await mobile.waitForFunction(v => document.documentElement.dataset.ccPlayableVersion === v, PLAYABLE_VERSION, { timeout: 15000 });
      const noOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

      const mobileCaptions = mobile.locator('#transcript-captions [data-tc-part="captions"]');
      await settleLocator(mobile, mobileCaptions);
      const mobileCaptionVideo = mobile.locator('#transcript-captions [data-tc-part="captions"] #tc-video');
      const mobileCaptionPaused = await mobileCaptionVideo.evaluate(video => video.paused && video.currentTime < 0.1);
      await mobile.locator('#tc-style-next').click();
      await mobile.waitForFunction(() => {
        const video = document.querySelector('#transcript-captions [data-tc-part="captions"] #tc-video');
        return Boolean(video && !video.paused);
      }, null, { timeout: 5000 });

      const mobileVideoStory = mobile.locator('#image-to-video .itv-story-video');
      await settleLocator(mobile, mobileVideoStory);
      const visibleVideoOptions = await mobileVideoStory.evaluate(root => [...root.querySelectorAll('.itv-option-button')].filter(button => {
        const style = getComputedStyle(button);
        return !button.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      }).length);

      report.mobileDiagnostics = {
        noOverflow,
        scrollWidth: await mobile.evaluate(() => document.documentElement.scrollWidth),
        clientWidth: await mobile.evaluate(() => document.documentElement.clientWidth),
        captionPaused: mobileCaptionPaused,
        visibleVideoOptions,
      };
      report.mobile = noOverflow && mobileCaptionPaused && visibleVideoOptions === 1;
      await mobile.screenshot({ path: path.join(SNAP_ROOT, '17-mobile-latest.png'), fullPage: false, animations: 'disabled' });
    } finally {
      await mobile.close();
    }

    const required = ['publicShape','expert','motion','transcript','captionsGated','image','video','music','mobile','stayedLocal'];
    const failures = required.filter(key => !report[key]);
    if (snapshotErrors.length) failures.push('snapshots');
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
