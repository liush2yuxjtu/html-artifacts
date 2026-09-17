import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIST = path.join(ROOT, 'dist');

const REQUIRED_FILES = Object.freeze([
  'index.html',
  'intent.html',
  'patches/home.css',
  'patches/home.js',
  '_meta/page-manifest.json',
  '_meta/asset-manifest.json',
  '_meta/runtime-manifest.json',
]);

function stripQueryHash(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function localPathToFile(distDir, urlPath) {
  const clean = stripQueryHash(urlPath);
  const decoded = clean
    .split('/')
    .map(segment => {
      try { return decodeURIComponent(segment); } catch { return segment; }
    })
    .join('/');
  return path.join(distDir, decoded.replace(/^\/+/, ''));
}

async function exists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function extractLocalResourcePaths(html) {
  const found = new Set();
  const patterns = [
    /\b(?:src|poster|component-url|renderer-url|before-hydration-url)\s*=\s*["'](\/[^"']+)["']/gi,
    /\burl\(\s*["']?(\/[^)"']+)["']?\s*\)/gi,
    /<link\b[^>]*\bhref\s*=\s*["'](\/[^"']+)["'][^>]*>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1];
      if (!value || value.startsWith('//')) continue;
      found.add(value);
    }
  }
  return [...found].sort();
}

export function extractLocalFeatureLinks(html) {
  const found = new Set();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["'](\/features(?:\/[^"'?#]*)?)["'][^>]*>/gi)) {
    found.add(match[1].replace(/\/$/, '') || '/features');
  }
  return [...found].sort();
}

export async function verifyDist(distDir = DEFAULT_DIST) {
  const failures = [];

  for (const relative of REQUIRED_FILES) {
    if (!(await exists(path.join(distDir, relative)))) failures.push(`missing required file: ${relative}`);
  }

  const pageManifestPath = path.join(distDir, '_meta/page-manifest.json');
  let pageManifest;
  try {
    pageManifest = JSON.parse(await fs.readFile(pageManifestPath, 'utf8'));
  } catch (error) {
    failures.push(`invalid page manifest: ${error.message}`);
  }

  const assetManifestPath = path.join(distDir, '_meta/asset-manifest.json');
  let assetManifest;
  try {
    assetManifest = JSON.parse(await fs.readFile(assetManifestPath, 'utf8'));
  } catch (error) {
    failures.push(`invalid asset manifest: ${error.message}`);
  }

  const runtimeManifestPath = path.join(distDir, '_meta/runtime-manifest.json');
  let runtimeManifest;
  try {
    runtimeManifest = JSON.parse(await fs.readFile(runtimeManifestPath, 'utf8'));
  } catch (error) {
    failures.push(`invalid runtime manifest: ${error.message}`);
  }

  if (assetManifest?.mediaMode === 'local') {
    const failedMedia = (assetManifest.media ?? []).filter(item => item?.status === 'failed');
    for (const item of failedMedia) {
      failures.push(`failed mirrored media: ${item.url}${item.error ? ` (${item.error})` : ''}`);
    }
    for (const item of assetManifest.media ?? []) {
      if (item?.status !== 'downloaded' || !item.localPath) continue;
      if (!(await exists(localPathToFile(distDir, item.localPath)))) {
        failures.push(`downloaded media missing from dist: ${item.url} -> ${item.localPath}`);
      }
    }
  }

  const runtimeAssets = runtimeManifest?.assets ?? [];
  if (runtimeManifest && runtimeAssets.length === 0) {
    failures.push('runtime manifest contains no pinned Astro assets');
  }
  for (const item of runtimeAssets) {
    if (!item?.url || !item?.output) {
      failures.push('runtime manifest contains malformed asset entry');
      continue;
    }
    if (!item.output.startsWith('/_astro/')) {
      failures.push(`runtime asset is outside /_astro: ${item.output}`);
      continue;
    }
    if (!(await exists(localPathToFile(distDir, item.output)))) {
      failures.push(`pinned runtime asset missing from dist: ${item.url} -> ${item.output}`);
    }
  }

  const routeToOutput = new Map();
  if (pageManifest?.pages) {
    for (const page of pageManifest.pages) {
      routeToOutput.set(page.pathname.replace(/\/$/, '') || '/', page.output);
      if (!(await exists(path.join(distDir, page.output)))) {
        failures.push(`missing mirrored page output: ${page.pathname} -> ${page.output}`);
      }
    }
  }

  const htmlFiles = new Set(['index.html', 'intent.html']);
  for (const output of routeToOutput.values()) htmlFiles.add(output);

  for (const relative of htmlFiles) {
    const full = path.join(distDir, relative);
    if (!(await exists(full))) continue;
    const html = await fs.readFile(full, 'utf8');

    for (const resourcePath of extractLocalResourcePaths(html)) {
      const clean = stripQueryHash(resourcePath);
      if (clean === '/' || clean.startsWith('/features')) continue;
      if (!(await exists(localPathToFile(distDir, resourcePath)))) {
        failures.push(`broken local resource in ${relative}: ${resourcePath}`);
      }
    }

    for (const featurePath of extractLocalFeatureLinks(html)) {
      if (!routeToOutput.has(featurePath)) {
        failures.push(`broken mirrored feature route in ${relative}: ${featurePath}`);
      }
    }
  }

  if (failures.length) {
    const error = new Error(`dist verification failed:\n- ${failures.join('\n- ')}`);
    error.failures = failures;
    throw error;
  }

  return {
    requiredFiles: REQUIRED_FILES.length,
    mirroredRoutes: routeToOutput.size,
    htmlFilesChecked: htmlFiles.size,
    mirroredMediaChecked: assetManifest?.mediaMode === 'local' ? (assetManifest.media ?? []).length : 0,
    pinnedRuntimeAssets: runtimeAssets.length,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyDist()
    .then(summary => console.log(JSON.stringify(summary, null, 2)))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
