import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://chatcut.io';
const ASTRO_PREFIX = '/_astro/';
const TEXT_ASSET_RE = /\.(?:css|m?js|json|svg)$/i;
const RUNTIME_ASSET_RE = /\.(?:css|m?js|json|svg|woff2?|ttf|otf|eot|png|jpe?g|webp|avif|gif|wasm)(?:[?#].*)?$/i;

function stripQueryHash(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function decodeEscapedSlashes(value) {
  return String(value).replace(/\\\//g, '/').replaceAll('&amp;', '&');
}

export function normalizeRuntimeUrl(value, parentUrl = `${ORIGIN}/`) {
  const decoded = decodeEscapedSlashes(value).trim().replace(/["'),;]+$/g, '');
  if (!decoded || decoded.startsWith('data:') || decoded.startsWith('blob:')) return null;
  let url;
  try {
    url = new URL(decoded, parentUrl);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN || !url.pathname.startsWith(ASTRO_PREFIX)) return null;
  if (!RUNTIME_ASSET_RE.test(url.pathname)) return null;
  url.hash = '';
  return url.toString();
}

export function runtimeOutputPath(runtimeUrl) {
  const url = new URL(runtimeUrl);
  if (url.origin !== ORIGIN || !url.pathname.startsWith(ASTRO_PREFIX)) {
    throw new Error(`Not a ChatCut Astro runtime asset: ${runtimeUrl}`);
  }
  return stripQueryHash(url.pathname).replace(/^\/+/, '');
}

export function extractRuntimeRefs(source, parentUrl = `${ORIGIN}/`) {
  const decoded = decodeEscapedSlashes(source);
  const found = new Set();
  const consider = (raw) => {
    const normalized = normalizeRuntimeUrl(raw, parentUrl);
    if (normalized) found.add(normalized);
  };

  for (const match of decoded.matchAll(/https:\/\/chatcut\.io\/_astro\/[A-Za-z0-9._~!$&()+,;=@%\/-]+(?:\?[^\s"'`<>)]+)?/gi)) {
    consider(match[0]);
  }
  for (const match of decoded.matchAll(/(?:^|[^A-Za-z0-9.:/])((?:\/_astro\/)[A-Za-z0-9._~!$&()+,;=@%\/-]+(?:\?[^\s"'`<>)]+)?)/gim)) {
    consider(match[1]);
  }
  for (const match of decoded.matchAll(/(?:^|[\s"'`(=:,])(\.\.?\/[A-Za-z0-9._~!$&()+,;=@%\/-]+\.(?:css|m?js|json|svg|woff2?|ttf|otf|eot|png|jpe?g|webp|avif|gif|wasm)(?:\?[^\s"'`<>)]+)?)/gim)) {
    consider(match[1]);
  }
  return [...found].sort();
}

export function shouldScanRuntimeHtml(relativePath) {
  const normalized = String(relativePath).split(path.sep).join('/').replace(/^\.\//, '');
  if (!normalized.endsWith('.html')) return false;
  if (normalized.startsWith('_raw/') || normalized.startsWith('_meta/')) return false;
  return true;
}

async function listHtmlFiles(dir) {
  const out = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const relative = path.relative(dir, full);
        if (shouldScanRuntimeHtml(relative)) out.push(full);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

async function fetchBufferWithRetry(url, { attempts = 3, timeoutMs = 30_000 } = {}) {
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
          accept: '*/*',
          referer: `${ORIGIN}/`,
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to pin ${url}: ${lastError?.message ?? lastError}`);
}

function localizeRuntimeText(text) {
  return text
    .replaceAll(`${ORIGIN}/_astro/`, '/_astro/')
    .replaceAll('https:\\/\\/chatcut.io\\/_astro\\/', '\\/_astro\\/');
}

async function readOrFetchRuntime(url, target) {
  try {
    return { buffer: await fs.readFile(target), reused: true };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return { buffer: await fetchBufferWithRetry(url), reused: false };
}

export async function pinRuntimeUrls(initialUrls, distDir = DEFAULT_DIST) {
  const queued = [];
  const seen = new Set();
  const manifest = [];
  const enqueue = (value, parentUrl = `${ORIGIN}/`) => {
    const url = normalizeRuntimeUrl(value, parentUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    queued.push(url);
  };

  for (const url of initialUrls) enqueue(url);

  for (let cursor = 0; cursor < queued.length; cursor += 1) {
    const url = queued[cursor];
    const output = runtimeOutputPath(url);
    const target = path.join(distDir, output);
    const { buffer, reused } = await readOrFetchRuntime(url, target);
    await fs.mkdir(path.dirname(target), { recursive: true });

    if (TEXT_ASSET_RE.test(stripQueryHash(url))) {
      const original = buffer.toString('utf8');
      const localized = localizeRuntimeText(original);
      await fs.writeFile(target, localized, 'utf8');
      for (const dependency of extractRuntimeRefs(localized, url)) enqueue(dependency, url);
    } else if (!reused) {
      await fs.writeFile(target, buffer);
    }

    manifest.push({
      url,
      output: `/${output}`,
      bytes: buffer.byteLength,
      reused,
    });
  }

  return manifest;
}

export async function pinRuntimeAssets(distDir = DEFAULT_DIST) {
  const htmlFiles = await listHtmlFiles(distDir);
  const roots = new Set();
  for (const htmlPath of htmlFiles) {
    const html = await fs.readFile(htmlPath, 'utf8');
    for (const url of extractRuntimeRefs(html, `${ORIGIN}/`)) roots.add(url);
  }

  const manifest = await pinRuntimeUrls([...roots], distDir);
  const metaDir = path.join(distDir, '_meta');
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(path.join(metaDir, 'runtime-manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceOrigin: ORIGIN,
    assets: manifest.sort((a, b) => a.url.localeCompare(b.url)),
  }, null, 2)}\n`, 'utf8');

  return { htmlFiles: htmlFiles.length, runtimeAssets: manifest.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  pinRuntimeAssets()
    .then(summary => console.log(JSON.stringify(summary, null, 2)))
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
