// Record real before → action → after clips of the v3 playable and the frozen
// original, for a human preview published as a claude.ai Artifact.
//
//   (cd chatcut-v3/site && python3 -m http.server 8777 --bind 127.0.0.1) &
//   node chatcut-v3/tests/record-preview.cjs http://127.0.0.1:8777/ /path/to/out
//
// Writes <out>/rec/*.webm (VP8, plays in any browser). Same env as qa.cjs:
// PLAYWRIGHT_MODULE, CHROMIUM_PATH, CHROMIUM_ARGS.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8777/';
const OUT = path.resolve(process.argv[3] || 'chatcut-v3/preview');
const REC = path.join(OUT, 'rec');
fs.mkdirSync(REC, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const CLIPS = [
  // name, viewport, mobile, page, section, trigger (null = original, no click), ms after trigger
  ['b01-playable-desktop', DESKTOP, false, 'index.html', '#editor-demo', '#editor-demo .cc3-video-overlay', 5000],
  ['b01-original-desktop', DESKTOP, false, 'baseline.html', '#editor-demo', null, 6000],
  ['b02-playable-desktop', DESKTOP, false, 'index.html', '#connect', '[data-cxwin] button[aria-label="Send"]', 21000],
  ['b02-original-desktop', DESKTOP, false, 'baseline.html', '#connect', null, 8000],
  ['b01-playable-mobile', MOBILE, true, 'index.html', '#editor-demo', '#editor-demo .cc3-video-overlay', 5000],
  ['b02-playable-mobile', MOBILE, true, 'index.html', '#connect', '#connect .cc3-cta', 21000],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean),
  });
  // Install sw.js once so every recorded context starts from a controlled page.
  const warm = await browser.newContext();
  await (await warm.newPage()).goto(BASE + 'index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2500));
  await warm.close();

  for (const [name, viewport, mobile, page, section, trigger, after] of CLIPS) {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: REC, size: viewport } });
    const tab = await context.newPage();
    await tab.goto(BASE + page, { waitUntil: 'load' });
    await tab.waitForTimeout(1500);
    await tab.reload({ waitUntil: 'load' });
    await tab.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), section);
    await tab.waitForTimeout(2500); // hold the "before" state on camera
    if (trigger) await tab.locator(trigger).first().click({ force: true });
    await tab.waitForTimeout(after);
    const video = tab.video();
    await context.close();
    fs.renameSync(await video.path(), path.join(REC, `${name}.webm`));
    console.log(`${name}.webm`);
  }
  await browser.close();
})();
