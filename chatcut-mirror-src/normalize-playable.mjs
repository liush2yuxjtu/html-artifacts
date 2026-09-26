/**
 * Make the generated playable portable and current. The pinned build input is
 * itself a packaged PR #10 Vercel preview, so it carries two leftovers:
 *
 * 1. Remote media behind that preview's own `/_media/<host>/<path>` proxy. The
 *    route exists only there: chatcut.io and GitHub Pages answer 404. Point
 *    each reference back at `https://<host>/<path>`; vercel-build.mjs
 *    re-localizes the CDN hosts it packages.
 * 2. A transcript autoplay guard pinned to playable v2, which switches off once
 *    build.mjs bumps the version. Upgrade it to "v2 or later".
 *
 * It also makes root-absolute runtime assets work below a sub-path such as
 * GitHub Pages' /html-artifacts/chatcut-playable/: images and clips under
 * /editor-scene/ and /codex-plugin/ load from chatcut.io, and the motion
 * template feed (no CORS on chatcut.io) is read from a vendored copy next to
 * index.html. vercel-build.mjs packages both again as same-origin files.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stopAutoplayTranscript } from './vercel-build.mjs';

const MEDIA = /(?:https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+)?\/_media\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/[^"'`\s<>)&\\]*)/gi;

export function canonicalizeMedia(text) {
  let count = 0;
  const out = text.replace(MEDIA, (_, host, rest) => { count++; return `https://${host}${rest}`; });
  return { text: out, count };
}

const ROOT_ASSET = /(["'`]|&quot;)\/((?:editor-scene|codex-plugin)\/)/g;
const FEED_FETCH = 'fetch("/landing-data/motion-templates/popular"';
export const FEED_FILE = 'landing-data/motion-templates/popular.json';
export const FEED_URL = 'https://chatcut.io/landing-data/motion-templates/popular';

export function normalizeFile(name, text) {
  let { text: out, count } = canonicalizeMedia(text);
  out = out.replace(ROOT_ASSET, (_, quote, prefix) => { count++; return `${quote}https://chatcut.io/${prefix}`; });
  // Resolve against the page, not the module; a bare path also keeps
  // vercel-build.mjs from mistaking it for an /_astro/ dependency.
  if (out.includes(FEED_FETCH)) { out = out.replaceAll(FEED_FETCH, `fetch(new URL("${FEED_FILE}",document.baseURI).href`); count++; }
  if (name.endsWith('.js')) {
    const guarded = stopAutoplayTranscript(out);
    if (guarded !== out) { out = guarded; count++; }
  }
  return { text: out, count };
}

async function* files(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (/\.(?:html|js|css|json)$/.test(entry.name)) yield file;
  }
}

// The runtime fetches the feed relative to the page; keep a copy beside it.
async function vendorFeed(dir) {
  const file = path.join(dir, FEED_FILE);
  try { await fs.access(file); return 0; } catch {}
  const response = await fetch(FEED_URL, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Motion template feed ${response.status}: ${FEED_URL}`);
  const body = await response.text();
  if (!Array.isArray(JSON.parse(body).templates)) throw new Error('Motion template feed has no templates array');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  return 1;
}

export async function normalizeTree(dir) {
  let total = await vendorFeed(dir);
  for await (const file of files(dir)) {
    const before = await fs.readFile(file, 'utf8');
    const { text, count } = normalizeFile(file, before);
    if (text !== before) { await fs.writeFile(file, text); total += count; }
  }
  return total;
}

if (process.argv[1] && import.meta.url === pathToFileURL(await fs.realpath(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] || 'chatcut-playable');
  console.log(`normalize-playable: ${await normalizeTree(root)} change(s) in ${path.relative(process.cwd(), root) || '.'}`);
}
