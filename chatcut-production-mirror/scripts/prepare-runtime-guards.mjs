import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function replaceOnce(relativePath, before, after, label) {
  const filePath = path.join(ROOT, relativePath);
  let source = await fs.readFile(filePath, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before)) {
    throw new Error(`${label}: expected source contract was not found in ${relativePath}`);
  }
  source = source.replace(before, after);
  await fs.writeFile(filePath, source, 'utf8');
  return true;
}

const pinGuardBefore = "if (!decoded || decoded.startsWith('data:') || decoded.startsWith('blob:')) return null;";
const pinGuardAfter = "if (!decoded || /\\$(?:\\{|%7b)/i.test(decoded) || decoded.startsWith('data:') || decoded.startsWith('blob:')) return null;";

const pagePinBefore = `async function fetchPageAndPinRuntime(pathname) {
  const pageUrl = toPageUrl(pathname);
  const html = await fetchWithRetry(pageUrl);
  const { stylesheets } = extractAssetUrls(html, pageUrl);
  if (stylesheets.length) await pinRuntimeUrls(stylesheets, DIST);
  return html;
}`;

const pagePinAfter = `async function fetchPageAndPinRuntime(pathname) {
  const pageUrl = toPageUrl(pathname);
  let lastRuntimeError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const html = await fetchWithRetry(pageUrl);
    const { stylesheets } = extractAssetUrls(html, pageUrl);
    try {
      if (stylesheets.length) await pinRuntimeUrls(stylesheets, DIST);
      return html;
    } catch (error) {
      lastRuntimeError = error;
      if (attempt < 4) {
        console.warn(\`Runtime pin drift for \${pathname} (attempt \${attempt}/4): \${error.message}\`);
        await new Promise(resolve => setTimeout(resolve, 750 * attempt));
      }
    }
  }
  throw lastRuntimeError;
}`;

const verifierBefore = `    if (!item.output.startsWith('/_astro/')) {
      failures.push(\`runtime asset is outside /_astro: \${item.output}\`);
      continue;
    }`;

const verifierAfter = `    if (!item.output.startsWith('/') || item.output.startsWith('//') || item.output.includes('..')) {
      failures.push(\`runtime asset output is not a safe local path: \${item.output}\`);
      continue;
    }`;

const changed = [];
if (await replaceOnce('scripts/pin-runtime.mjs', pinGuardBefore, pinGuardAfter, 'dynamic runtime placeholder guard')) changed.push('pin-runtime');
if (await replaceOnce('scripts/mirror.mjs', pagePinBefore, pagePinAfter, 'upstream runtime drift retry')) changed.push('mirror');
if (await replaceOnce('scripts/verify-dist.mjs', verifierBefore, verifierAfter, 'safe local runtime verifier')) changed.push('verify-dist');

console.log(`Runtime hardening ready${changed.length ? `: patched ${changed.join(', ')}` : ': already applied'}`);
