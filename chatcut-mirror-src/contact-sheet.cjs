const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SNAP_ROOT = path.resolve('chatcut-snapshots');
const pages = [
  ['Hero', ['01-hero.png']],
  ['Expert Editor', ['02-expert-before.png', '03-expert-after.png']],
  ['AI Motion Graphics', ['04-motion-before.png', '05-motion-after.png']],
  ['Transcript + Captions', ['06-transcript-before.png', '07-transcript-after.png', '08-captions-native.png']],
  ['AI Image Generation', ['09-image-before.png', '10-image-after.png']],
  ['AI Video Generation', ['11-video-before.png', '12-video-after.png']],
  ['AI Music', ['13-music-before.png', '14-music-after.png']],
];

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}

for (const [, files] of pages) {
  for (const file of files) {
    if (!fs.existsSync(path.join(SNAP_ROOT, file))) throw new Error(`Missing snapshot: ${file}`);
  }
}

const pageHtml = pages.map(([title, files]) => {
  const figures = files.map((file, index) => {
    const label = files.length === 1 ? 'Rendered' : index === 0 ? 'Before' : index === 1 ? 'After' : 'Native';
    return `<figure><div class="shot"><img src="${escapeHtml(file)}" alt="${escapeHtml(title + ' ' + label)}"></div><figcaption>${escapeHtml(label)}</figcaption></figure>`;
  }).join('');
  return `<section class="sheet"><header><h1>${escapeHtml(title)}</h1><p>ChatCut production-copy playable · 1440px browser snapshot</p></header><div class="grid grid-${files.length}">${figures}</div></section>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatCut visual QA snapshots</title><style>
@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#e8e5df;color:#211a13;font-family:Arial,Helvetica,sans-serif}.sheet{page-break-after:always;break-after:page;width:100%;min-height:190mm;background:#fcfbfd;padding:8mm;border:1px solid #d9d4ca}.sheet:last-child{page-break-after:auto;break-after:auto}header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:5mm}h1{margin:0;font-size:22px;line-height:1.05}p{margin:0;color:#777066;font-size:9px}.grid{display:grid;gap:5mm;height:158mm}.grid-1{grid-template-columns:1fr}.grid-2{grid-template-columns:1fr 1fr}.grid-3{grid-template-columns:1fr 1fr 1fr}figure{min-width:0;margin:0;display:flex;flex-direction:column;gap:2mm}.shot{flex:1;min-height:0;border:1px solid #d9d4ca;border-radius:4mm;background:white;padding:2mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.shot img{display:block;max-width:100%;max-height:100%;object-fit:contain}figcaption{text-align:center;color:#625c54;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
@media screen{body{padding:24px}.sheet{max-width:1200px;min-height:760px;margin:0 auto 24px}.grid{height:640px}}
</style></head><body>${pageHtml}</body></html>`;

fs.writeFileSync(path.join(SNAP_ROOT, 'contact-sheet.html'), html, 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const url = new URL('file://' + path.join(SNAP_ROOT, 'contact-sheet.html'));
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.pdf({
      path: path.join(SNAP_ROOT, 'contact-sheet.pdf'),
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
  console.log('Generated chatcut-snapshots/contact-sheet.pdf');
})().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});