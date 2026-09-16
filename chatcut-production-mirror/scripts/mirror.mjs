import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverFeaturePaths,
  extractAssetUrls,
  assetOutputPath,
  pageOutputPath,
  sanitizeHtml,
  rewritePageLinks,
  rewriteMediaUrls,
  injectHomepagePatch,
} from './mirror-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://chatcut.io';
const MEDIA_RE = /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|aac)(?:[?#].*)?$/i;
const FONT_RE = /\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i;

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

async function fetchWithRetry(url, { binary = false, attempts = 3, timeoutMs = 30000 } = {}) {
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
          accept: binary ? '*/*' : 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return binary ? new Uint8Array(await response.arrayBuffer()) : await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
}

function buildMediaMap(mediaUrls, mediaMode) {
  const map = new Map();
  if (mediaMode !== 'local') return map;
  for (const url of mediaUrls) {
    if (!shouldDownloadMedia(url)) continue;
    map.set(url, `/${assetOutputPath(url)}`);
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
      try {
        const bytes = await fetchWithRetry(url, { binary: true, attempts: 2, timeoutMs: 45000 });
        await ensureParent(target);
        await fs.writeFile(target, bytes);
        results.push({ url, status: 'downloaded', localPath: `/${relative}`, bytes: bytes.byteLength });
      } catch (error) {
        results.push({ url, status: 'failed', localPath: null, error: error.message });
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
  const mediaMap = buildMediaMap([...allMedia], mediaMode);

  for (const { pathname } of pageManifest) {
    const raw = pageHtml.get(pathname);
    let served = sanitizeHtml(raw);
    served = rewritePageLinks(served);
    if (mediaMode === 'local') served = rewriteMediaUrls(served, mediaMap);
    if (pathname === '/') served = injectHomepagePatch(served);
    await writeText(pageOutputPath(pathname), served);
  }

  await copyIfExists('patches/home.css');
  await copyIfExists('patches/home.js');
  await copyIfExists('patches/demo-session.js');
  await copyIfExists('intent.html');
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
    fontPolicy: 'Font binaries are intentionally not copied; production stylesheets load them from the original host.',
  }, null, 2));

  return {
    pages: pageManifest.length,
    featurePages: featurePaths.length,
    mediaAssets: allMedia.size,
    downloadedMedia: mediaResults.filter(x => x.status === 'downloaded').length,
    failedMedia: mediaResults.filter(x => x.status === 'failed').length,
    mediaMode,
  };
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
