const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const rawBaseUrl = process.env.CHATCUT_PREVIEW_URL || 'https://chatcut-production-mirror-pr3.vercel.app';
const baseUrl = rawBaseUrl.replace(/\/$/, '');
const artifactDir = path.resolve(process.env.CHATCUT_PREVIEW_ARTIFACT_DIR || 'artifacts/preview-qa');
const browserExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

const extraHTTPHeaders = {};
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  extraHTTPHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  extraHTTPHeaders['x-vercel-set-bypass-cookie'] = 'true';
}
if (process.env.VERCEL_TRUSTED_OIDC_TOKEN) {
  extraHTTPHeaders['x-vercel-trusted-oidc-idp-token'] = process.env.VERCEL_TRUSTED_OIDC_TOKEN;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function routeUrl(route) {
  return new URL(route, `${baseUrl}/`).toString();
}

function isRelevantConsoleError(message) {
  const text = message.text();
  if (message.type() !== 'error') return false;
  // Ignore a browser-only media decode error if the page still renders; everything else is acceptance signal.
  return !/media.*decode|PIPELINE_ERROR_DECODE/i.test(text);
}

async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 12_000 });
  } catch {
    await page.waitForTimeout(1_500);
  }
}

async function openChecked(page, route, label) {
  const response = await page.goto(routeUrl(route), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await settle(page);

  const title = await page.title();
  const body = await page.locator('body').innerText();
  const finalUrl = page.url();

  assert(response, `${label}: navigation returned no response`);
  assert(response.status() < 400, `${label}: HTTP ${response.status()} at ${finalUrl}`);
  assert(!/vercel\.com\/login/i.test(finalUrl), `${label}: blocked by Vercel Authentication (${finalUrl})`);
  assert(!/Log in to Vercel|Protected Deployment/i.test(body), `${label}: Vercel Deployment Protection intercepted the page`);
  assert(!/This page doesn.?t exist|404\s+NOT_FOUND|404\s+Not Found/i.test(body), `${label}: rendered a 404/not-found page`);
  assert(body.trim().length > 80, `${label}: page body is unexpectedly empty`);

  return { status: response.status(), title, finalUrl, body };
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const report = {
    baseUrl,
    authMode: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? 'automation-bypass-secret'
      : process.env.VERCEL_TRUSTED_OIDC_TOKEN
        ? 'github-oidc-trusted-source'
        : 'none',
    routes: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    interaction: null,
    mobile: null,
  };

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable,
    args: ['--no-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders,
    });
    const page = await context.newPage();

    page.on('console', (message) => {
      if (!isRelevantConsoleError(message)) return;
      report.consoleErrors.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error) => report.pageErrors.push(String(error)));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      const url = request.url();
      if (/google-analytics|segment|posthog|sentry/i.test(url)) return;
      report.requestFailures.push({ url, errorText: failure?.errorText || 'unknown' });
    });

    const home = await openChecked(page, '/', 'homepage');
    assert(/Edit videos by telling AI what you want|YOUR AI VIDEO EDITOR/i.test(home.body), 'homepage: expected ChatCut hero copy was not found');
    await page.screenshot({ path: path.join(artifactDir, 'desktop-home.png'), fullPage: true });
    report.routes.push({ route: '/', status: home.status, title: home.title, finalUrl: home.finalUrl });

    const demoButton = page.locator('button[aria-label="Apply editing prompt"]');
    await demoButton.waitFor({ state: 'visible', timeout: 12_000 });
    await demoButton.click();
    await page.waitForTimeout(350);
    const demoState = await page.evaluate(() => ({
      session: document.documentElement.dataset.ccDemoSession || '',
      status: document.querySelector('#best-moments .cc-demo-status')?.textContent || '',
    }));
    assert(/"expert":"running"|"expert":"done"/.test(demoState.session), `homepage interaction: DemoSession did not advance (${demoState.session})`);
    assert(/Playing|Done|Click the video/i.test(demoState.status), `homepage interaction: visible status did not advance (${demoState.status})`);
    report.interaction = demoState;
    await page.screenshot({ path: path.join(artifactDir, 'desktop-home-after-interaction.png'), fullPage: true });

    const intent = await openChecked(page, '/intent.html', 'intent route');
    report.routes.push({ route: '/intent.html', status: intent.status, title: intent.title, finalUrl: intent.finalUrl });
    await page.screenshot({ path: path.join(artifactDir, 'desktop-intent.png'), fullPage: true });

    const feature = await openChecked(page, '/features/ai-motion-graphics', 'feature route');
    assert(/motion graphics|AI Motion/i.test(feature.body), 'feature route: expected motion graphics content was not found');
    report.routes.push({ route: '/features/ai-motion-graphics', status: feature.status, title: feature.title, finalUrl: feature.finalUrl });
    await page.screenshot({ path: path.join(artifactDir, 'desktop-feature-motion.png'), fullPage: true });

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    const mobileHome = await openChecked(mobile, '/', 'mobile homepage');
    const overflow = await mobile.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert(overflow.scrollWidth <= overflow.innerWidth + 2, `mobile homepage: horizontal overflow ${overflow.scrollWidth}px > ${overflow.innerWidth}px`);
    report.mobile = { ...overflow, status: mobileHome.status, finalUrl: mobileHome.finalUrl };
    await mobile.screenshot({ path: path.join(artifactDir, 'mobile-home.png'), fullPage: true });
    await mobile.close();

    assert(report.pageErrors.length === 0, `browser page errors: ${report.pageErrors.join(' | ')}`);
    assert(report.consoleErrors.length === 0, `browser console errors: ${report.consoleErrors.map((entry) => entry.text).join(' | ')}`);

    fs.writeFileSync(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`PASS ChatCut preview browser QA: ${baseUrl}`);
    console.log(`Auth mode: ${report.authMode}`);
    console.log(`Routes: ${report.routes.map((entry) => `${entry.route}=${entry.status}`).join(', ')}`);
  } catch (error) {
    fs.writeFileSync(path.join(artifactDir, 'report.json'), `${JSON.stringify({ ...report, failure: String(error?.stack || error) }, null, 2)}\n`);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
