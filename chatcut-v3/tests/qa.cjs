// Browser acceptance for the v3 playable homepage.
//
//   node chatcut-v3/tests/qa.cjs http://127.0.0.1:8777/
//
// Env: CHROMIUM_PATH (optional executable), CHROMIUM_ARGS (extra flags,
// space separated), PLAYWRIGHT_MODULE (module path, default "playwright").
// Drives desktop 1440 and mobile 390, performs the real clicks, asserts the
// before/after state of every flow, and writes screenshots to
// chatcut-v3/evidence/. Exit 0 = PASS.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8777/';
const OUT = path.resolve(process.env.QA_OUT || 'chatcut-v3/evidence');
fs.mkdirSync(OUT, { recursive: true });

// Known production issue: this font 404s on chatcut.io itself.
const KNOWN = [/workflow-story\/dm-sans-v4\.woff2/];
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };

async function open(browser, viewport, mobile) {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !KNOWN.some(r => r.test(m.text()))) errors.push(`console ${m.text()}`); });
  page.on('response', r => {
    const u = r.url();
    if (/chatcut\.io\/_astro\//.test(u)) errors.push(`remote runtime ${u}`);
    if (r.status() >= 400 && !KNOWN.some(k => k.test(u))) errors.push(`http ${r.status()} ${u}`);
  });
  // First visit installs sw.js and reloads once; start measuring after that.
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  errors.length = 0;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.ccV3 && document.querySelector('#editor-demo .fe-composer'), null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}

async function editorFlow(page, tag) {
  const section = page.locator('#editor-demo');
  await section.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => {
    const s = document.getElementById('editor-demo');
    const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return {
      awaiting: s.classList.contains('cc3-editor-awaiting'),
      chatVisible: [...s.querySelectorAll('.fe-chat > *')].some(vis),
      prompt: s.querySelector('.cc3-editor-prompt')?.textContent || '',
      timelineOpacity: getComputedStyle(s.querySelector('.feh-tl')).opacity,
      status: s.querySelector('.cc3-status')?.textContent,
    };
  });
  const overlayFit = () => page.evaluate(() => {
    const s = document.getElementById('editor-demo');
    const o = s.querySelector(':scope > .cc3-video-overlay');
    const v = s.querySelector('[data-home-demo-mode="creator"] .hve-viewer');
    if (!o || o.hidden || !v) return { ok: false, why: !o ? 'no overlay' : o.hidden ? 'hidden' : 'no viewer' };
    const a = o.getBoundingClientRect(), b = v.getBoundingClientRect();
    const drift = Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const cta = s.querySelector('.cc3-status .cc3-cta');
    return { ok: drift <= 1 && !!hit && !!hit.closest('.cc3-video-overlay'), drift: +drift.toFixed(2), hitOverlay: !!hit && !!hit.closest('.cc3-video-overlay'), ctaHidden: !cta || cta.hidden, w: Math.round(b.width) };
  });
  await section.screenshot({ path: path.join(OUT, `${tag}-b01-before.jpg`), type: 'jpeg', quality: 70 });
  check(before.awaiting && !before.chatVisible, `${tag} B01 before: chat result held`);
  check(/retro feel/.test(before.prompt), `${tag} B01 before: production prompt waits in composer`);
  check(Number(before.timelineOpacity) < 0.5, `${tag} B01 before: timeline shows pending`);
  const fit1 = await overlayFit();
  check(fit1.ok, `${tag} B01 overlay covers the video exactly and receives the click (drift ${fit1.drift}px, ${fit1.why || 'hit ' + fit1.hitOverlay})`);
  check(fit1.ctaHidden, `${tag} B01 overlay is the only trigger (status Send hidden)`);
  // Stable under re-fit: resize, let the mock re-scale, re-check alignment.
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.round(vp.width * 0.8), height: vp.height });
  await page.waitForTimeout(600);
  const fit2 = await overlayFit();
  await page.setViewportSize(vp);
  await page.waitForTimeout(600);
  const fit3 = await overlayFit();
  check(fit2.ok && fit3.ok, `${tag} B01 overlay stays aligned after resize (drift ${fit2.drift}px → ${fit3.drift}px)`);
  await section.scrollIntoViewIfNeeded();
  await page.locator('#editor-demo .cc3-video-overlay').click();
  await page.waitForFunction(() => window.ccV3.session.editor === 'done', null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const s = document.getElementById('editor-demo');
    const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return {
      state: window.ccV3.session.editor,
      reply: vis(s.querySelector('.fe-assistant-row')),
      user: vis(s.querySelector('.fe-user')),
      timelineOpacity: getComputedStyle(s.querySelector('.feh-tl')).opacity,
      statuses: s.querySelectorAll('.cc3-status').length,
      ctaHidden: s.querySelector('.cc3-cta')?.hidden,
      overlayHidden: s.querySelector('.cc3-video-overlay')?.hidden,
    };
  });
  await section.screenshot({ path: path.join(OUT, `${tag}-b01-after.jpg`), type: 'jpeg', quality: 70 });
  check(after.state === 'done' && after.reply && after.user, `${tag} B01 after: production reply shown in place`);
  check(Number(after.timelineOpacity) > 0.95, `${tag} B01 after: timeline result revealed`);
  check(after.statuses === 1 && after.ctaHidden && after.overlayHidden, `${tag} B01 exactly one status line, overlay retired`);
  // Regression: the patch must go quiet after a flow finishes (no per-frame rewrites).
  const churn = await page.evaluate(() => new Promise(resolve => {
    let n = 0;
    const mo = new MutationObserver(ms => { n += ms.filter(m => m.target.closest && m.target.closest('.cc3-status,[data-cc3-send]')).length; });
    mo.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
    setTimeout(() => { mo.disconnect(); resolve(n); }, 1500);
  }));
  check(churn === 0, `${tag} B01 patch idle after done (${churn} self-mutations in 1.5s)`);
}

async function agentFlow(page, tag) {
  const connect = page.locator('#connect');
  await connect.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => {
    const w = document.querySelector('[data-cxwin]');
    const steps = [...w.querySelectorAll('[data-astep]')];
    const send = w.querySelector('button[aria-label="Send"]');
    const editor = document.querySelector('#connect .had-editor');
    return { shown: steps.filter(s => Number(s.style.opacity || 0) > 0.5).length, total: steps.length, enabled: send && !send.disabled, editorOpacity: Number(getComputedStyle(editor).opacity) };
  });
  await connect.screenshot({ path: path.join(OUT, `${tag}-b02-before.jpg`), type: 'jpeg', quality: 70 });
  check(before.total > 0 && before.shown === 0, `${tag} B02 before: agent run held at first frame (${before.shown}/${before.total})`);
  check(before.enabled, `${tag} B02 before: Send is the enabled trigger`);
  check(before.editorOpacity < 0.5, `${tag} B02 before: destination editor pending`);
  const send = page.locator(tag === 'mobile' ? '#connect .cc3-cta' : '[data-cxwin] button[aria-label="Send"]');
  await send.scrollIntoViewIfNeeded();
  await send.click();
  await page.waitForFunction(() => window.ccV3.session.codex === 'done', null, { timeout: 32000 }).catch(() => {});
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const w = document.querySelector('[data-cxwin]');
    const steps = [...w.querySelectorAll('[data-astep]')];
    return { editorOpacity: Number(getComputedStyle(document.querySelector('#connect .had-editor')).opacity), state: window.ccV3.session.codex, done: steps.filter(s => s.dataset.state === 'done').length, total: steps.length, status: document.querySelector('.cc3-status[data-for="agent"]')?.textContent };
  });
  await connect.screenshot({ path: path.join(OUT, `${tag}-b02-after.jpg`), type: 'jpeg', quality: 70 });
  check(after.state === 'done' && after.done === after.total, `${tag} B02 after: production steps completed (${after.done}/${after.total})`);
  check(after.editorOpacity > 0.95, `${tag} B02 after: destination editor revealed`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean),
  });
  for (const [tag, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
    const { page, errors } = await open(browser, viewport, mobile);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${tag} no horizontal overflow (${overflow}px)`);
    const patches = await page.evaluate(() => document.querySelectorAll('script[data-cc-v3-patch]').length);
    check(patches === 1, `${tag} patch injected exactly once`);
    await editorFlow(page, tag);
    await agentFlow(page, tag);
    await page.screenshot({ path: path.join(OUT, `${tag}-full.jpg`), type: 'jpeg', quality: 45, fullPage: true });
    const unique = [...new Set(errors)];
    unique.slice(0, 10).forEach(e => console.log(`  ${e.slice(0, 200)}`));
    check(unique.length === 0, `${tag} no page/console/HTTP errors (${unique.length})`);
    await page.close();
  }
  await browser.close();
  console.log(failures.length ? `\nFAIL (${failures.length})` : '\nPASS');
  process.exit(failures.length ? 1 : 0);
})();
