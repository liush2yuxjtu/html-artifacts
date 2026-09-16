import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.resolve('chatcut-playable/index.html');
const marker = 'data-cc-playable-island-safe';

let html = await fs.readFile(file, 'utf8');
const before = `  const q = (s, r=document) => r.querySelector(s);\n  const qa = (s, r=document) => Array.from(r.querySelectorAll(s));`;
const after = `  const isHydrationPending = el => Boolean(el?.closest?.('astro-island[ssr]'));\n  const q = (s, r=document) => {\n    const el = r.querySelector(s);\n    return el && !isHydrationPending(el) ? el : null;\n  };\n  const qa = (s, r=document) => Array.from(r.querySelectorAll(s)).filter(el => !isHydrationPending(el));`;

if (!html.includes(before)) {
  throw new Error('ChatCut playable query helper contract changed; island-safe patch not applied');
}
html = html.replace(before, after);
if (!html.includes(marker)) {
  html = html.replace(/<\/head\s*>/i, `<meta ${marker} content="1"></head>`);
}
await fs.writeFile(file, html, 'utf8');
console.log('Applied per-island hydration guard to playable queries.');
