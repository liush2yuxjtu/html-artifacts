import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.resolve('chatcut-playable/index.html');
const marker = 'data-cc-playable-visual-fix';
const css = `
<style ${marker}>
/* Snapshot-driven polish: keep the pre-action states recognizably ChatCut.
   The old dimming made Motion/Image/Music read like missing content rather
   than a product demo waiting for one action. */
.cc-demo-status{
  margin-top:6px!important;
  min-height:14px!important;
  font-size:11px!important;
  line-height:1.3!important;
  color:#827a71!important;
}

#motion-graphics.cc-motion-awaiting .agentic-thinking-card{
  opacity:.70!important;
  filter:saturate(.82)!important;
}
#motion-graphics.cc-motion-generated .agentic-thinking-card{
  opacity:1!important;
  filter:none!important;
}

#image-to-video .itv-story.cc-image-source .itv-showcase-img{
  opacity:1!important;
  filter:none!important;
}
#image-to-video .itv-story.cc-image-source .itv-showcase::after{
  content:'Ready to generate'!important;
  inset:auto 10px 10px auto!important;
  width:auto!important;
  height:auto!important;
  display:block!important;
  padding:5px 8px!important;
  border:1px solid rgba(111,103,95,.16)!important;
  border-radius:999px!important;
  color:#6f675f!important;
  background:rgba(252,251,253,.90)!important;
  backdrop-filter:blur(4px);
}
#image-to-video .itv-story.cc-image-generated .itv-showcase-img{
  opacity:1!important;
  filter:none!important;
}

#music-generation.cc-music-awaiting .tc-music-board{
  opacity:.64!important;
  filter:saturate(.72)!important;
}
#music-generation.cc-music-loading .tc-music-board{
  opacity:.78!important;
  filter:saturate(.84)!important;
}
#music-generation.cc-music-generated .tc-music-board{
  opacity:1!important;
  filter:none!important;
}

/* Make the added trigger feel native rather than like a floating black dot. */
.cc-local-send{
  width:30px!important;
  height:30px!important;
  box-shadow:0 2px 8px rgba(0,0,0,.10)!important;
}
</style>`;

let html = await fs.readFile(file, 'utf8');
if (html.includes(marker)) {
  html = html.replace(/<style data-cc-playable-visual-fix>[\s\S]*?<\/style>/, css.trim());
} else {
  html = html.replace(/<\/head\s*>/i, `${css}</head>`);
}
await fs.writeFile(file, html, 'utf8');
console.log('Applied snapshot-driven ChatCut visual polish.');
