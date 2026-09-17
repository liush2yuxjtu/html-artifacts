/** Package the checked-in playable homepage, not the obsolete v1 live rebuild. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sanitizeHtml, rewritePageLinks, pageOutputPath } from '../chatcut-production-mirror/scripts/mirror-lib.mjs';
import { BASELINE_FEATURE_PATHS } from '../chatcut-production-mirror/scripts/mirror.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.vercel/output');
const STATIC = path.join(OUT, 'static');
const ORIGIN = 'https://chatcut.io';
export const HOME_ALIASES = ['en', 'zh', 'zh-hant', 'es', 'ja'];
export const PAGES = ['/', '/features', ...BASELINE_FEATURE_PATHS];
export function sanitizeMirror(html) {
  return sanitizeHtml(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag =>
    /runBrowserLocaleBootstrap|auth\/get-session/.test(tag) ? '' : tag);
}
export function prepareHomepage(html) {
  if (!html.includes('data-cc-playable-hydration-safe') || !html.includes("ccPlayableVersion = '2'"))
    throw new Error('The checked-in homepage must contain playable v2 and the hydration fix.');
  return sanitizeMirror(html)
    .replaceAll('./_astro/', '/_astro/')
    .replace(/(href=["'])https:\/\/chatcut\.io(\/(?:features(?:\/[^"'?#]*)?)?)([?#][^"']*)?(["'])/g,
      (_, prefix, route, suffix = '', end) => `${prefix}${route}${suffix}${end}`);
}
export function guardProductionSession(source) {
  return source.replace(/(\.useEffect\(\(\)=>\{)(?=fetch\(`\$\{[^}]+\}\/auth\/get-session`)/g,
    '$1if(window.location.origin!=="https://chatcut.io")return;');
}
// Astro removes its SSR marker when its renderer returns. The mirrored React
// renderer schedules hydration in a transition; the DOM overlay can otherwise
// observe that marker before React has committed. Keep initial island hydration
// synchronous at this integration boundary, without replacing SSR or hiding errors.
export function synchronizeAstroHydration(source) {
  const before = 'na.startTransition(()=>{my(T,()=>{const il=vy.hydrateRoot(T,_,_a);';
  const after = 'jh().flushSync(()=>{my(T,()=>{const il=vy.hydrateRoot(T,_,_a);';
  if (!source.includes('const il=vy.hydrateRoot(T,_,_a);')) return source;
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error('Astro React hydration integration changed; review the renderer contract.');
  return source.replace(before, after);
}
export function stopAutoplayTranscript(source) {
  const before = 'St=e=>{const n=e>=.22';
  const after = 'St=e=>{if(window.__chatcutDemoSession&&document.documentElement.dataset.ccPlayableVersion==="2")return;const n=e>=.22';
  return source.includes(before) ? source.replace(before, after) : source;
}
export function prepareVisibleControls(html) {
  const before = "const el = r.querySelector(s);\n    return el && !touchesHydrationPending(el) ? el : null;";
  const after = "const candidates = Array.from(r.querySelectorAll(s)).filter(el => !touchesHydrationPending(el));\n    return candidates.find(el => el.getClientRects().length > 0) || candidates[0] || null;";
  if (!html.includes(before)) throw new Error('Playable selector contract changed.');
  html = html.replace(before, after);
  const oldDock = "const dock = q('[data-thread-dock=\"mg\"]', root) || q('.agentic-thinking-static', root);";
  const newDock = "const dock = q('[aria-label=\"Generate\"]', root)?.parentElement || q('[data-thread-dock=\"mg\"]', root) || q('.agentic-thinking-static', root);";
  if (!html.includes(oldDock)) throw new Error('Motion dock contract changed.');
  html = html.replace(oldDock, newDock);
  const statusLine = "const status = ensureStatus(root, 'motion', dock, 'Ready · generate these graphics in place');";
  return html.replace(statusLine, statusLine + "\n    if (dock && status && status.parentElement !== dock) dock.append(status);");
}
export function outputConfig() {
  return { version: 3, routes: [
    { src: '^/(?:en|zh|zh-hant|es|ja)/?$', status: 307, headers: { Location: '/' } },
    ...PAGES.filter(p => p !== '/').map(p => ({ src: `^${p}/?$`, dest: `/${pageOutputPath(p)}` })),
    { src: '^/intent$', dest: '/intent.html' },
    { src: '^/landing-data/motion-templates/popular$', dest: '/landing-data/motion-templates/popular.json', headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    { handle: 'filesystem' }
  ] };
}
async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}
async function fetchBytes(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: {
        'user-agent': 'Mozilla/5.0 ChatCutMirrorVerification/1.0', accept: '*/*'
      }});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { last = error; }
  }
  throw last;
}
const visited = new Set();
const assets = [];
const staticMedia = new Set();
const remoteImages = new Set();
function collectCdnImages(text) {
  for (const m of text.matchAll(/https:\/\/cdn\.chatcut\.dev\/[^"'<>\s&)]+\.(?:svg|png|webp|jpe?g|gif|avif|ico)/g)) {
    if (!m[0].includes('${')) remoteImages.add(m[0]);
  }
}
function collectImages(html) {
  collectCdnImages(html);
  for (const m of html.matchAll(/https:\/\/chatcut\.io(\/[^"'<>\s&)]+\.(?:svg|png|webp|jpe?g|gif|avif|ico))/g)) { if (!m[1].includes('${')) staticMedia.add(m[1]); }
}
function astroUrl(spec, base) {
  try {
    const url = new URL(spec.replaceAll('&amp;', '&'), base);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/_astro/')) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}
async function mirrorAsset(url) {
  const key = url.pathname;
  if (visited.has(key)) return;
  visited.add(key);
  const file = path.join(STATIC, key.replace(/^\/+/, ''));
  let bytes;
  try { bytes = await fs.readFile(file); }
  catch { bytes = await fetchBytes(url.href); }
  const deps = new Map();
  const replaceSpec = spec => {
    const dep = astroUrl(spec, url.href);
    if (!dep) return null;
    deps.set(dep.pathname, dep);
    let rel = path.posix.relative(path.posix.dirname(url.pathname), dep.pathname);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  };
  if (/\.m?js$/.test(key)) {
    let source = stopAutoplayTranscript(synchronizeAstroHydration(guardProductionSession(bytes.toString('utf8'))));
    collectCdnImages(source);
    for (const match of source.matchAll(/(["'`])(\/(?!\/)[^"'`\s${}<>]+\.(?:svg|png|webp|jpe?g|gif|avif|ico))\1/g)) staticMedia.add(match[2]);
    source = source.replace(/(["'`])((?:https:\/\/chatcut\.io)?(?:\.\.?\/|\/)[^"'`\s]+?)\1/g,
      (match, quote, spec) => { const rel = replaceSpec(spec); return rel ? quote + rel + quote : match; });
    bytes = Buffer.from(source);
  } else if (/\.css$/.test(key)) {
    let source = bytes.toString('utf8');
    source = source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,
      (match, quote, spec) => { const rel = replaceSpec(spec.trim()); return rel ? `url(${quote}${rel}${quote})` : match; });
    bytes = Buffer.from(source);
  }
  await write(file, bytes);
  assets.push({ path: key, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  for (const dep of deps.values()) await mirrorAsset(dep);
}
async function localizeHtml(html) {
  const entries = new Map();
  for (const m of html.matchAll(/(?:https:\/\/chatcut\.io)?\/_astro\/[^"'<>\s&)]+/g)) {
    const url = astroUrl(m[0], ORIGIN);
    if (url) entries.set(url.pathname, url);
  }
  for (const entry of entries.values()) await mirrorAsset(entry);
  return html.replaceAll(ORIGIN + '/_astro/', '/_astro/');
}
export async function buildVercel() {
  visited.clear(); assets.length = 0; staticMedia.clear(); remoteImages.clear();
  staticMedia.add('/codex-plugin/chatgpt-mark.svg');
  staticMedia.add('/codex-plugin/claude-mark.svg');
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(STATIC, { recursive: true });
  await fs.cp(path.join(ROOT, 'chatcut-playable/_astro'), path.join(STATIC, '_astro'), { recursive: true });
  const home = prepareVisibleControls(prepareHomepage(await fs.readFile(path.join(ROOT, 'chatcut-playable/index.html'), 'utf8')));
  collectImages(home);
  await write(path.join(STATIC, 'index.html'), await localizeHtml(home));
  const pages = [{ path: '/', source: 'chatcut-playable/index.html', bytes: Buffer.byteLength(home) }];
  for (const route of PAGES.slice(1)) {
    console.log('Capturing route', route);
    const raw = (await fetchBytes(ORIGIN + route)).toString('utf8');
    let html = rewritePageLinks(sanitizeMirror(raw));
    // Astro serializes root-relative media inside HTML-encoded props.
    html = html.replace(/(&quot;)(\/(?!\/)[^&<>\s]*?)(?=&quot;)/g, (_, q, p) => q + ORIGIN + p);
    collectImages(html);
    html = await localizeHtml(html);
    if (!/<h1\b/.test(html)) throw new Error('No h1 in route ' + route);
    await write(path.join(STATIC, pageOutputPath(route)), html);
    pages.push({ path: route, source: ORIGIN + route, bytes: Buffer.byteLength(html) });
  }
  console.log('Capturing original motion-template response and runtime image dependencies');
  const data = await fetchBytes(ORIGIN + '/landing-data/motion-templates/popular');
  if (!Array.isArray(JSON.parse(data.toString('utf8')).templates)) throw new Error('Invalid real motion template response');
  await write(path.join(STATIC, 'landing-data/motion-templates/popular.json'), data);
  const imageQueue = [...staticMedia];
  let cursor = 0;
  async function imageWorker() {
    while (cursor < imageQueue.length) {
      const media = imageQueue[cursor++];
      let bytes; let sourceUrl = ORIGIN + media;
      try { bytes = await fetchBytes(sourceUrl); }
      catch (error) {
        if (!media.startsWith('/playback/')) throw error;
        sourceUrl = 'https://cdn.chatcut.dev' + media;
        bytes = await fetchBytes(sourceUrl);
      }
      await write(path.join(STATIC, media.replace(/^\/+/, '')), bytes);
      assets.push({ path: media, sourceUrl, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  await Promise.all(Array.from({ length: 6 }, imageWorker));
  const cdnMap = new Map();
  const remoteQueue = [...remoteImages];
  let remoteCursor = 0;
  async function cdnWorker() {
    while (remoteCursor < remoteQueue.length) {
      const url = remoteQueue[remoteCursor++];
      const parsed = new URL(url);
      const local = '/_media/' + parsed.hostname + parsed.pathname;
      const bytes = await fetchBytes(url);
      await write(path.join(STATIC, local.replace(/^\/+/, '')), bytes);
      cdnMap.set(url, local);
      assets.push({ path: local, sourceUrl: url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  await Promise.all(Array.from({ length: 6 }, cdnWorker));
  async function rewriteLocalImages(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { await rewriteLocalImages(file); continue; }
      if (!/\.(?:html|js|css)$/.test(file)) continue;
      let content = await fs.readFile(file, 'utf8');
      for (const media of imageQueue) content = content.split(ORIGIN + media).join(media);
      for (const [url, local] of cdnMap) content = content.split(url).join(local);
      // Do not send already-localized runtime resources back to production after hydration.
      const localPaths = JSON.stringify([...new Set([...PAGES, '/intent.html', '/intent', ...imageQueue, ...cdnMap.values()])]);
      content = content.replace("return 'https://chatcut.io' + value;",
        `if (${localPaths}.includes(value.split(/[?#]/)[0])) return value; return 'https://chatcut.io' + value;`);
      await fs.writeFile(file, content);
    }
  }
  await rewriteLocalImages(STATIC);
  for (const asset of assets) {
    const bytes = await fs.readFile(path.join(STATIC, asset.path.replace(/^\/+/, '')));
    asset.bytes = bytes.length;
    asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  await fs.copyFile(path.join(ROOT, 'chatcut-production-mirror/intent.html'), path.join(STATIC, 'intent.html'));
  const provenance = {
    generatedAt: new Date().toISOString(),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
    homepageSha256: createHash('sha256').update(await fs.readFile(path.join(STATIC, 'index.html'))).digest('hex'),
    homepage: 'Checked-in production DOM with playable v2, hydration and hit-test fixes',
    localePolicy: 'English-only mirror: locale home aliases redirect to the canonical English homepage.',
    mediaPolicy: 'Original public ChatCut CDN media; required runtime JS/CSS is same-origin.',
    pages, assets
  };
  await write(path.join(STATIC, '_meta/build.json'), JSON.stringify(provenance, null, 2));
  await write(path.join(OUT, 'config.json'), JSON.stringify(outputConfig(), null, 2));
  console.log(JSON.stringify({ ok: true, pages: pages.length + 1, runtimeAssets: assets.length, out: OUT }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildVercel().catch(error => { console.error(error); process.exitCode = 1; });
}
