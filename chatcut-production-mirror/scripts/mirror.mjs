import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  discoverFeaturePaths,
  extractAssetUrls,
  assetOutputPath,
  pageOutputPath,
  sanitizeHtml,
  freezeAstroHydration,
  rewritePageLinks,
  rewriteMediaUrls,
  injectHomepagePatch,
} from './mirror-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://chatcut.io';
const MEDIA_RE = /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|aac)(?:[?#].*)?$/i;
const FONT_RE = /\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i;
const VIDEO_RE = /\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i;

const FALLBACK_INTENT_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatCut · Copy → Edit Intent</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fcfbfd;color:#211a13}main{max-width:920px;margin:auto;padding:64px 24px}h1{font-size:clamp(36px,7vw,72px);line-height:.98;letter-spacing:-.04em}p{font-size:18px;line-height:1.6;color:#6f675e}.flow{margin-top:36px;padding:28px;border:1px solid #e7e1d9;border-radius:18px;background:white;font-size:22px;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}.card{padding:20px;border:1px solid #e7e1d9;border-radius:16px;background:white}.card b{display:block;margin-bottom:8px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main><p>ChatCut · interview prototype</p><h1>不是 rebuild。<br>复制原站，再直接编辑。</h1><div class="flow">原 production component → 保留原 layout / CSS / video / assets → 只增加一个本地 trigger → 原结果继续发生在原组件里。</div><div class="grid"><div class="card"><b>Homepage</b>Best Moments、Motion Graphics、Transcript、Image、Video、Music 变成原地 playable。</div><div class="card"><b>Feature pages</b>保持 production mirror，不扩散 redesign。</div><div class="card"><b>Captions / Pricing</b>原本已经清楚的交互保持不动。</div><div class="card"><b>核心目标</b>截图仍然像 ChatCut；点击以后才发现 demo 会继续。</div></div></main></body></html>`;

export const BASELINE_FEATURE_PATHS = Object.freeze([
  '/features/ai-video-editor',
  '/features/ai-motion-graphics',
  '/features/ai-video-generator',
  '/features/ai-captions',
  '/features/ai-voiceover',
  '/features/ai-music',
  '/features/ai-image-generator',
  '/features/ai-noise-removal',
  '/features/ai-sound-effects',
  '/features/text-based-editing',
]);

export function shouldDownloadMedia(url) {
  return MEDIA_RE.test(url) && !FONT_RE.test(url);
}

export function outputPathForRawSnapshot(pathname) {
  if (pathname === '/') return '_raw/home.source.html';
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  return path.posix.join('_raw', `${clean}.source.html`);
}

function toPageUrl(pathname) {
  return new URL(pathname, ORIGIN).toString();
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeText(relativePath, content) {
  const target = path.join(DIST, relativePath);
  await ensureParent(target);
  await fs.writeFile(target, content, 'utf8');
}

async function fetchWithRetry(url, { attempts = 3, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 ChatCutInterviewMirror/1.0',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
}

async function downloadBinaryWithRetry(url, target, { attempts = 3, timeoutMs = 60000 } = {}) {
  let lastError;
  await ensureParent(target);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const temp = `${target}.part-${process.pid}-${attempt}`;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 ChatCutInterviewMirror/1.0',
          accept: '*/*',
          referer: `${ORIGIN}/`,
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (!response.body) throw new Error('response body is empty');

      await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
      const stat = await fs.stat(temp);
      if (!stat.size) throw new Error('downloaded file is empty');
      await fs.rename(temp, target);
      return stat.size;
    } catch (error) {
      lastError = error;
      await fs.rm(temp, { force: true }).catch(() => {});
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
}

export function rewriteRuntimeAssetUrls(html) {
  return html
    .replaceAll(`${ORIGIN}/_astro/`, '/_astro/')
    .replaceAll('https:\\/\\/chatcut.io\\/_astro\\/', '\\/_astro\\/');
}

export function classifyMediaFailure(error) {
  const message = String(error?.message ?? error ?? '');
  return /(?:^|\s)(?:404|410)(?:\s|$)/.test(message) ? 'upstream-missing' : 'failed';
}

export function buildMediaMap(mediaResults, mediaMode) {
  const map = new Map();
  if (mediaMode !== 'local') return map;
  for (const item of mediaResults) {
    if (item?.status !== 'downloaded' || !item.localPath) continue;
    map.set(item.url, item.localPath);
  }
  return map;
}

async function downloadMedia(mediaUrls, mediaMode) {
  const results = [];
  if (mediaMode !== 'local') {
    return mediaUrls.map(url => ({ url, status: 'remote-preview', localPath: null }));
  }

  const queue = [...new Set(mediaUrls)].filter(shouldDownloadMedia);
  const concurrency = Math.max(1, Math.min(8, Number(process.env.MIRROR_CONCURRENCY || 6)));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor++;
      const url = queue[index];
      const relative = assetOutputPath(url);
      const target = path.join(DIST, relative);
      const isVideo = VIDEO_RE.test(url);
      try {
        const bytes = await downloadBinaryWithRetry(url, target, {
          attempts: isVideo ? 4 : 3,
          timeoutMs: isVideo ? 180000 : 60000,
        });
        results.push({ url, status: 'downloaded', localPath: `/${relative}`, bytes });
      } catch (error) {
        results.push({ url, status: classifyMediaFailure(error), localPath: null, error: error.message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

async function copyIfExists(sourceRelative, destRelative = sourceRelative) {
  const source = path.join(ROOT, sourceRelative);
  try {
    await fs.access(source);
  } catch {
    return false;
  }
  const dest = path.join(DIST, destRelative);
  await ensureParent(dest);
  await fs.copyFile(source, dest);
  return true;
}

export async function buildMirror({ mediaMode = process.env.MIRROR_MEDIA_MODE || 'remote' } = {}) {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const pageHtml = new Map();
  const pageManifest = [];
  const allMedia = new Set();
  const allStylesheets = new Set();
  const allScripts = new Set();

  const indexPaths = ['/', '/features'];
  for (const pathname of indexPaths) {
    const html = await fetchWithRetry(toPageUrl(pathname));
    pageHtml.set(pathname, html);
  }

  const discovered = discoverFeaturePaths(pageHtml.get('/features'));
  const featurePaths = [...new Set([...BASELINE_FEATURE_PATHS, ...discovered])].sort();
  const allPaths = ['/', '/features', ...featurePaths];

  for (const pathname of allPaths) {
    let raw = pageHtml.get(pathname);
    if (!raw) raw = await fetchWithRetry(toPageUrl(pathname));
    pageHtml.set(pathname, raw);
    await writeText(outputPathForRawSnapshot(pathname), raw);

    const assets = extractAssetUrls(raw, toPageUrl(pathname));
    assets.media.forEach(url => allMedia.add(url));
    assets.stylesheets.forEach(url => allStylesheets.add(url));
    assets.scripts.forEach(url => allScripts.add(url));
    pageManifest.push({ pathname, sourceUrl: toPageUrl(pathname), output: pageOutputPath(pathname), assets });
  }

  const mediaResults = await downloadMedia([...allMedia].sort(), mediaMode);
  const mediaMap = buildMediaMap(mediaResults, mediaMode);
  const homepagePatchScript = await fs.readFile(path.join(ROOT, 'patches/home.js'), 'utf8');

  for (const { pathname } of pageManifest) {
    const raw = pageHtml.get(pathname);
    let served = sanitizeHtml(raw);
    served = freezeAstroHydration(served);
    served = rewritePageLinks(served);
    served = rewriteRuntimeAssetUrls(served);
    if (mediaMode === 'local') served = rewriteMediaUrls(served, mediaMap);
    if (pathname === '/') served = injectHomepagePatch(served, homepagePatchScript);
    await writeText(pageOutputPath(pathname), served);
  }

  await copyIfExists('patches/home.css');
  await copyIfExists('patches/home.js');
  await copyIfExists('patches/demo-session.js');
  const copiedIntent = await copyIfExists('intent.html');
  if (!copiedIntent) await writeText('intent.html', FALLBACK_INTENT_HTML);
  await copyIfExists('intent.md', '_meta/intent.md');
  await copyIfExists('README.md', '_meta/README.md');

  await writeText('_meta/page-manifest.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceOrigin: ORIGIN,
    mediaMode,
    pages: pageManifest,
  }, null, 2));

  await writeText('_meta/asset-manifest.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    mediaMode,
    media: mediaResults,
    stylesheets: [...allStylesheets].sort(),
    scripts: [...allScripts].sort(),
    runtimePolicy: 'Astro hydration is frozen to server-rendered markup; CSS/font runtime dependencies are pinned into dist/_astro.',
  }, null, 2));

  const summary = {
    pages: pageManifest.length,
    featurePages: featurePaths.length,
    mediaAssets: allMedia.size,
    downloadedMedia: mediaResults.filter(x => x.status === 'downloaded').length,
    failedMedia: mediaResults.filter(x => x.status === 'failed').length,
    missingUpstreamMedia: mediaResults.filter(x => x.status === 'upstream-missing').length,
    mediaMode,
  };

  if (mediaMode === 'local' && summary.failedMedia > 0) {
    const failed = mediaResults.filter(x => x.status === 'failed');
    throw new Error(`Local mirror is incomplete: ${failed.length} media asset(s) failed:\n${failed.map(item => `- ${item.url}: ${item.error}`).join('\n')}`);
  }

  return summary;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  buildMirror()
    .then(summary => console.log(JSON.stringify(summary, null, 2)))
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
