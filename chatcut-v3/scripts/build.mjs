// Build the v3 playable homepage from the committed variant B baseline.
//
//   node chatcut-v3/scripts/build.mjs
//
// Input:  chatcut-v3/site/baseline.html (frozen by snapshot.mjs)
// Output: chatcut-v3/site/index.html    (baseline + one patch layer)
//         chatcut-v3/site/compare.html  (original vs playable, side by side)
//
// No network access: the build is deterministic for a given baseline.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('chatcut-v3');
const SITE = path.join(ROOT, 'site');

export function applyPatch(baseline, css, js) {
  if (!baseline.includes('id="editor-demo"') || !baseline.includes('data-cxwin')) {
    throw new Error('baseline is not chatcut.io variant B (missing #editor-demo or [data-cxwin])');
  }
  if (baseline.includes('data-cc-v3-patch')) throw new Error('baseline already carries the v3 patch');
  // The agent components ship a full send → steps → reveal timeline, but the
  // homepage marks them conversation-only so they render the finished run.
  // Manual mode keeps them at their first frame until `cxwin:play`/`ccr:play`.
  let html = baseline.replace(/<div class="(cxwin-root|ccr)"([^>]*)>/g, (tag, cls, attrs) => {
    let next = attrs.replace(/\sdata-conversation-only(?:="")?/g, '');
    if (!/\sdata-manual\b/.test(next)) next += ' data-manual';
    return `<div class="${cls}"${next}>`;
  });
  if (/<[a-z][^<>]*\sdata-conversation-only\b[^<>]*>/i.test(html)) throw new Error('unexpected data-conversation-only outside agent panels');
  html = html.replace(/<meta name="cc-v3-baseline"/, '<meta name="cc-v3-playable" content="1"><meta name="cc-v3-baseline"');
  html = html.replace(/<\/head>/i, () => `<style data-cc-v3-patch>\n${css}</style></head>`);
  html = html.replace(/<\/body>/i, () => `<script data-cc-v3-patch>\n${js}</script></body>`);
  return html;
}

// Compare URLs, not strings: argv[1] may contain spaces, symlinks or Windows paths.
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(await fs.realpath(process.argv[1])).href;
if (isMain) {
  const [baseline, css, js] = await Promise.all([
    fs.readFile(path.join(SITE, 'baseline.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'runtime', 'patch.css'), 'utf8'),
    fs.readFile(path.join(ROOT, 'runtime', 'patch.js'), 'utf8'),
  ]);
  const html = applyPatch(baseline, css, js);
  await fs.writeFile(path.join(SITE, 'index.html'), html);
  await fs.copyFile(path.join(ROOT, 'runtime', 'sw.js'), path.join(SITE, 'sw.js'));
  // Side-by-side review page: frozen original (baseline.html) vs playable (index.html).
  await fs.copyFile(path.join(ROOT, 'runtime', 'compare.html'), path.join(SITE, 'compare.html'));
  console.log(JSON.stringify({ ok: true, bytes: html.length, out: 'chatcut-v3/site/index.html' }));
}
