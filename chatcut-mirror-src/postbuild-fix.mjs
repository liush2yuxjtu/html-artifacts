import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.resolve('chatcut-playable/index.html');
const marker = 'data-cc-playable-layer-fix';
const css = `
<style ${marker}>
/* The production Best Moments animation has full-stage visual layers that can
   sit above its prompt card. They are aria-hidden presentation only, so keep
   them visually intact but out of the pointer hit-test path. */
#best-moments .bm-prompt-card{z-index:80!important;pointer-events:auto!important}
#best-moments .bm-prompt-input{z-index:81!important}
#best-moments .bm-final-row,
#best-moments .bm-final-video-card,
#best-moments .bm-scan-frame,
#best-moments .bm-editor-timeline-surface,
#best-moments .bm-editor-timeline-chrome{pointer-events:none!important}
</style>`;

let html = await fs.readFile(file, 'utf8');
if (html.includes(marker)) {
  html = html.replace(/<style data-cc-playable-layer-fix>[\s\S]*?<\/style>/, css.trim());
} else {
  html = html.replace(/<\/head\s*>/i, `${css}</head>`);
}
await fs.writeFile(file, html, 'utf8');
console.log('Applied ChatCut playable layer hit-test fix.');
