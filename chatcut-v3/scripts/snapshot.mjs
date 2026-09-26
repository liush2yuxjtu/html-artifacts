// Capture both live chatcut.io homepage variants and freeze variant B as a
// runnable baseline. chatcut.io serves an A/B experiment from the same URL
// (cookie chatcut_homepage_415_20260920_id); we keep both raw documents and
// localize the variant B runtime so later builds never depend on which
// variant the CDN happens to return.
//
//   node chatcut-v3/scripts/snapshot.mjs
//
// Writes:
//   chatcut-v3/baseline/raw/variant-a.html   untouched production HTML (legacy)
//   chatcut-v3/baseline/raw/variant-b.html   untouched production HTML (new)
//   chatcut-v3/site/_astro/**                JS/CSS/fonts the variant B runtime loads
//   chatcut-v3/site/{fonts,landing-data}/**  same-origin data the runtime fetches
//   chatcut-v3/site/baseline.html            runnable variant B, no product patch
//   chatcut-v3/baseline/manifest.json        provenance + hashes
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ORIGIN = 'https://chatcut.io';
const ROOT = path.resolve('chatcut-v3');
const SITE = path.join(ROOT, 'site');
const RAW = path.join(ROOT, 'baseline', 'raw');
const EXPERIMENT_COOKIE = 'chatcut_homepage_415_20260920_id';

// Paths the runtime requests from its own origin with fetch()/FontFace. They
// are copied next to the page; every other root-relative asset (images,
// videos) is pointed at chatcut.io so the repository stays small.
const LOCAL_PREFIXES = ['/_astro/', '/fonts/', '/landing-data/'];
const TRACKING = /googletagmanager|posthog|ahrefs|firstpromoter|cloudflareinsights|doubleclick|google-analytics|clarity\.ms|hotjar/i;

// Registers sw.js (see chatcut-v3/runtime/sw.js). On the very first visit the
// page is not controlled yet, so reload once as soon as the worker takes over.
export const SW_BOOT = `<script data-cc-v3-sw>(()=>{if(!('serviceWorker' in navigator))return;const k='cc-v3-sw-reloaded';let done=false;try{done=sessionStorage.getItem(k)==='1'}catch(e){}navigator.serviceWorker.register('./sw.js').catch(()=>{});if(navigator.serviceWorker.controller||done)return;navigator.serviceWorker.addEventListener('controllerchange',()=>{try{sessionStorage.setItem(k,'1')}catch(e){}location.reload()},{once:true})})();</script>`;

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const isVariantB = html => html.includes('id="creator-wall"') && html.includes('id="editor-demo"');
const isVariantA = html => html.includes('id="best-moments"');

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 ChatCutV3Snapshot/1.0', accept: '*/*', 'cache-control': 'no-cache' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function captureVariants(maxTries = 24) {
  const found = {};
  for (let i = 0; i < maxTries && !(found.a && found.b); i += 1) {
    const html = (await get(`${ORIGIN}/`)).toString('utf8');
    if (!found.b && isVariantB(html)) found.b = html;
    else if (!found.a && isVariantA(html)) found.a = html;
  }
  if (!found.b) throw new Error('variant B (creator-wall/editor-demo) was not served in any attempt');
  return found;
}

const localized = new Map();
function localPath(pathname) {
  return path.join(SITE, decodeURIComponent(pathname).replace(/^\/+/, ''));
}

function isLocal(u) {
  return u.origin === ORIGIN && LOCAL_PREFIXES.some(p => u.pathname.startsWith(p));
}

// Module specifiers resolve against the importing module; fetch()/url() in JS
// resolve against the document. Keep _astro imports module-relative and
// rewrite every other same-origin path to a document-relative one.
function rewriteJs(source, fromUrl, deps) {
  return source.replace(/(["'`])((?:https:\/\/chatcut\.io)?(?:\.\.?)?\/(?!\/)[A-Za-z0-9_\-./%@]+(?:\?[^"'`\s]*)?)\1/g, (m, q, spec) => {
    let u;
    try { u = new URL(spec, fromUrl); } catch { return m; }
    if (u.origin !== ORIGIN) return m;
    // "./chunk.js" inside a module is already module-relative: fetch it, keep it.
    if (spec.startsWith('.')) {
      if (u.pathname.startsWith('/_astro/')) deps.add(u.href);
      return m;
    }
    if (u.pathname.startsWith('/_astro/')) {
      deps.add(u.href);
      let rel = path.posix.relative(path.posix.dirname(new URL(fromUrl).pathname), u.pathname);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `${q}${rel}${q}`;
    }
    if (isLocal(u)) {
      deps.add(u.href);
      return `${q}./${u.pathname.slice(1)}${u.search}${q}`;
    }
    // Everything else (images, videos, asset roots that the runtime
    // concatenates) stays byte-identical; sw.js forwards those requests.
    return m;
  });
}

function rewriteCss(source, fromUrl, deps) {
  return source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, spec) => {
    if (/^data:/i.test(spec.trim())) return m;
    let u;
    try { u = new URL(spec.trim(), fromUrl); } catch { return m; }
    if (u.origin !== ORIGIN) return m;
    if (isLocal(u)) {
      deps.add(u.href);
      let rel = path.posix.relative(path.posix.dirname(new URL(fromUrl).pathname), u.pathname);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `url(${q}${rel}${q})`;
    }
    return `url(${q}${u.href}${q})`;
  });
}

async function localize(url) {
  const u = new URL(url);
  u.hash = '';
  const key = u.origin + u.pathname;
  if (localized.has(key)) return;
  localized.set(key, null);
  let bytes;
  try {
    bytes = await get(u.href);
  } catch (error) {
    // A few runtime paths (e.g. a missing DM Sans woff2) 404 in production
    // too; record them instead of failing the snapshot.
    localized.set(key, { path: u.pathname, error: String(error.message || error) });
    return;
  }
  const deps = new Set();
  let out = bytes;
  if (/\.m?js$/i.test(u.pathname)) out = Buffer.from(rewriteJs(bytes.toString('utf8'), u.href, deps));
  else if (/\.css$/i.test(u.pathname)) out = Buffer.from(rewriteCss(bytes.toString('utf8'), u.href, deps));
  const file = localPath(u.pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, out);
  localized.set(key, { path: u.pathname, bytes: out.length, sha256: sha(out) });
  for (const dep of deps) await localize(dep);
}

function stripTracking(html) {
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => (TRACKING.test(tag) ? '' : tag));
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, tag => (TRACKING.test(tag) ? '' : tag));
  html = html.replace(/<link\b[^>]*>/gi, tag => (TRACKING.test(tag) ? '' : tag));
  return html;
}

async function buildBaseline(raw) {
  let html = stripTracking(raw);
  const deps = new Set();
  // Attribute values: src, href, poster, srcset entries, Astro island urls.
  html = html.replace(/\b(src|href|poster|component-url|renderer-url|before-hydration-url|data-src|data-poster|content)="([^"]*)"/gi, (m, attr, value) => {
    const rewriteOne = spec => {
      const s = spec.trim();
      if (!s.startsWith('/') || s.startsWith('//')) {
        if (!s.startsWith(ORIGIN + '/')) return spec;
      }
      const u = new URL(s, ORIGIN + '/');
      if (isLocal(u)) { deps.add(u.href); return './' + u.pathname.slice(1) + u.search; }
      return u.href;
    };
    return `${attr}="${rewriteOne(value)}"`;
  });
  html = html.replace(/\bsrcset="([^"]*)"/gi, (m, value) => `srcset="${value.split(',').map(part => {
    const [spec, ...rest] = part.trim().split(/\s+/);
    if (spec.startsWith('/') && !spec.startsWith('//')) return [ORIGIN + spec, ...rest].join(' ');
    return part.trim();
  }).join(', ')}"`);
  // Inline <style>/<script> may also carry root-relative asset paths.
  html = html.replace(/(<script\b(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, body, close) => {
    if (/application\/ld\+json/i.test(open)) return m;
    return open + rewriteJs(body, ORIGIN + '/', deps) + close;
  });
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, body, close) => open + rewriteCss(body, ORIGIN + '/', deps).replace(/url\((["']?)\.\//g, 'url($1') + close);
  for (const dep of deps) await localize(dep);
  // The mirror origin is anonymous by definition. Answer the production
  // session probe locally instead of letting it fail CORS (and never redirect
  // a signed-in reviewer into app.chatcut.io).
  const sessionShim = `<script data-cc-v3-session-shim>(()=>{const f=window.fetch;window.fetch=function(i,o){const u=String(i&&i.url||i);if(/^https:\\/\\/api\\.chatcut\\.io\\/auth\\/get-session/.test(u))return Promise.resolve(new Response('null',{status:200,headers:{'content-type':'application/json'}}));return f.apply(this,arguments)}})();</script>`;
  html = html.replace(/<head>/i, () => `<head>${sessionShim}${SW_BOOT}`);
  html = html.replace(/<head>/i, `<head><meta name="cc-v3-baseline" content="chatcut.io variant B · ${new Date().toISOString()}">`);
  return html;
}

await fs.rm(SITE, { recursive: true, force: true });
await fs.mkdir(SITE, { recursive: true });
await fs.mkdir(RAW, { recursive: true });

const variants = await captureVariants();
await fs.writeFile(path.join(RAW, 'variant-b.html'), variants.b);
if (variants.a) await fs.writeFile(path.join(RAW, 'variant-a.html'), variants.a);

const baseline = await buildBaseline(variants.b);
await fs.copyFile(path.join(ROOT, 'runtime', 'sw.js'), path.join(SITE, 'sw.js'));
await fs.writeFile(path.join(SITE, 'baseline.html'), baseline);

const files = [...localized.values()].filter(Boolean);
const manifest = {
  capturedAt: new Date().toISOString(),
  source: `${ORIGIN}/`,
  experimentCookie: EXPERIMENT_COOKIE,
  variants: {
    a: variants.a ? { sections: 'legacy: best-moments / transcript-captions / image-to-video / music-generation', bytes: Buffer.byteLength(variants.a), sha256: sha(variants.a) } : null,
    b: { sections: [...variants.b.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map(m => m[1]), bytes: Buffer.byteLength(variants.b), sha256: sha(variants.b) },
  },
  localized: files.filter(f => !f.error).length,
  localizedBytes: files.reduce((n, f) => n + (f.bytes || 0), 0),
  missing: files.filter(f => f.error),
  remote: 'Images and videos stay on https://chatcut.io and https://cdn.chatcut.dev.',
};
await fs.writeFile(path.join(ROOT, 'baseline', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ ...manifest, variants: { a: !!manifest.variants.a, b: manifest.variants.b.sections } }, null, 2));
