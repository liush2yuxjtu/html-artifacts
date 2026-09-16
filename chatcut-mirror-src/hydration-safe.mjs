import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.resolve('chatcut-playable/index.html');
const marker = 'data-cc-playable-hydration-safe';

let html = await fs.readFile(file, 'utf8');

const legacyBoot = /  function boot\(\) \{\n    document\.addEventListener\('click', handleClick, true\);\n    document\.addEventListener\('astro:page-load', renderAll\);\n    new MutationObserver\(scheduleRender\)\.observe\(document\.documentElement, \{ childList:true, subtree:true \}\);\n    renderAll\(\);\n  \}\n\n  if \(document\.readyState === 'loading'\) document\.addEventListener\('DOMContentLoaded', boot, \{ once:true \}\);\n  else boot\(\);/;

const safeBoot = `  let overlayObserver = null;
  let overlayStarted = false;

  const absoluteChatCutUrl = value => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
    return 'https://chatcut.io' + value;
  };

  const normalizeHydratedRootUrls = () => {
    document.querySelectorAll('astro-island').forEach(island => {
      island.querySelectorAll('[src],[poster],[href],[action],[srcset]').forEach(el => {
        for (const attr of ['src','poster','href','action']) {
          const value = el.getAttribute(attr);
          const next = absoluteChatCutUrl(value);
          if (next !== value) el.setAttribute(attr, next);
        }
        const srcset = el.getAttribute('srcset');
        if (srcset && srcset.includes('/')) {
          const nextSrcset = srcset.split(',').map(candidate => {
            const trimmed = candidate.trim();
            if (!trimmed) return trimmed;
            const parts = trimmed.split(/\\s+/);
            parts[0] = absoluteChatCutUrl(parts[0]);
            return parts.join(' ');
          }).join(', ');
          if (nextSrcset !== srcset) el.setAttribute('srcset', nextSrcset);
        }
      });
    });
  };

  const startOverlay = () => {
    if (overlayStarted) return;
    overlayStarted = true;
    normalizeHydratedRootUrls();
    renderAll();
    overlayObserver = new MutationObserver(() => {
      normalizeHydratedRootUrls();
      scheduleRender();
    });
    overlayObserver.observe(document.documentElement, { childList:true, subtree:true });
  };

  const waitForHydration = (startedAt) => {
    const pending = document.querySelector('astro-island[ssr]');
    const timedOut = performance.now() - startedAt > 5000;
    if (!pending || timedOut) {
      requestAnimationFrame(() => requestAnimationFrame(startOverlay));
      return;
    }
    setTimeout(() => waitForHydration(startedAt), 50);
  };

  const scheduleAfterPageLoad = () => {
    overlayStarted = false;
    if (overlayObserver) {
      overlayObserver.disconnect();
      overlayObserver = null;
    }
    waitForHydration(performance.now());
  };

  function boot() {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('astro:page-load', scheduleAfterPageLoad);
    waitForHydration(performance.now());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();`;

if (!legacyBoot.test(html)) {
  throw new Error('ChatCut playable boot contract changed; hydration-safe patch not applied');
}

html = html.replace(legacyBoot, safeBoot);
if (!html.includes(marker)) {
  html = html.replace(/<\/head\s*>/i, `<meta ${marker} content="1"></head>`);
}

await fs.writeFile(file, html, 'utf8');
console.log('Applied hydration-safe ChatCut playable boot lifecycle.');
