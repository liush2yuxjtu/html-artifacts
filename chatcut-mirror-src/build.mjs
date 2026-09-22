import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://chatcut.io';
const OUT = path.resolve('chatcut-playable');
const VERIFIED_FALLBACK = 'https://chatcut-production-mirror-preview-73uactwqj.vercel.app/';

const PATCH_CSS = String.raw`
/* ChatCut playable patch v2: production DOM/assets stay authoritative; only demo state is layered on top. */
.cc-demo-status{margin-top:8px;color:#7b736a;font-size:12px;line-height:1.35;min-height:16px}
.cc-local-send{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:999px;background:#111;color:#fff;cursor:pointer;box-shadow:0 5px 16px rgba(0,0,0,.12);transition:opacity .15s ease,transform .15s ease}
.cc-local-send svg{width:15px;height:15px}.cc-local-send:hover{opacity:.88}.cc-local-send:active{transform:scale(.96)}
.cc-generate-overlay{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;gap:9px;background:rgba(255,255,255,.78);backdrop-filter:blur(5px);color:#211a13;font-size:13px;font-weight:650;border-radius:inherit}
.cc-spinner{width:16px;height:16px;border:2px solid rgba(33,26,19,.18);border-top-color:#211a13;border-radius:50%;animation:cc-spin .7s linear infinite}@keyframes cc-spin{to{transform:rotate(360deg)}}

#best-moments.cc-expert-awaiting .bm-stage *{animation-play-state:paused!important}
#best-moments .bm-prompt-card{pointer-events:auto!important}
#best-moments .bm-prompt-input{position:relative;padding-right:42px}
#best-moments .bm-prompt-input>.cc-local-send{position:absolute;right:7px;top:50%;transform:translateY(-50%);z-index:8}
#best-moments .bm-prompt-input>.cc-local-send:active{transform:translateY(-50%) scale(.96)}
#best-moments.cc-expert-running .bm-final-video-card,#best-moments.cc-expert-done .bm-final-video-card{opacity:1!important}
#best-moments.cc-expert-running .bm-final-row,#best-moments.cc-expert-done .bm-final-row{opacity:1!important}

#motion-graphics.cc-motion-awaiting .agentic-thinking-card{opacity:.28;filter:saturate(.55) blur(.5px);transition:opacity .35s ease,filter .35s ease,transform .35s ease}
#motion-graphics.cc-motion-awaiting .agentic-thinking-card *{animation-play-state:paused!important}
#motion-graphics.cc-motion-generated .agentic-thinking-card{opacity:1;filter:none;transition:opacity .35s ease,filter .35s ease,transform .35s ease}
#motion-graphics.cc-motion-generated .agentic-thinking-card:nth-child(2){transform:translateY(-4px);box-shadow:0 18px 42px rgba(35,28,20,.14)}

#transcript-captions [data-tc-part="edit"] .tc-word[data-tc-filler="true"]{transition:opacity .18s ease,color .18s ease,text-decoration-color .18s ease}
#transcript-captions [data-tc-part="edit"] .tc-word.cc-filler-marked{opacity:.35;color:#9e958b;text-decoration:line-through;text-decoration-thickness:1.5px}
#transcript-captions [data-tc-part="edit"] .tc-word.cc-filler-removed{display:none!important}

#image-to-video .itv-showcase,#image-to-video .itv-video-showcase{position:relative}
#image-to-video .itv-story.cc-image-source .itv-showcase-img{filter:saturate(.35) blur(2px);opacity:.34;transition:filter .35s ease,opacity .35s ease}
#image-to-video .itv-story.cc-image-source .itv-showcase::after{content:'Waiting to generate';position:absolute;inset:0;z-index:9;display:grid;place-items:center;color:#6f675f;font-size:12px;font-weight:650;letter-spacing:.01em;background:linear-gradient(180deg,rgba(252,251,253,.18),rgba(252,251,253,.42));pointer-events:none}
#image-to-video .itv-story.cc-image-generated .itv-showcase-img{filter:none;opacity:1;transition:filter .35s ease,opacity .35s ease}
#image-to-video .itv-story-video.cc-video-awaiting .itv-showcase-video,
#image-to-video .itv-story-video.cc-video-loading .itv-showcase-video{opacity:0!important}
#image-to-video .itv-story-video.cc-video-awaiting .itv-video-poster,
#image-to-video .itv-story-video.cc-video-loading .itv-video-poster{opacity:1!important}
#image-to-video .itv-story-video.cc-video-generated .itv-showcase-video{opacity:1!important}
#image-to-video .itv-story-video.cc-video-generated .itv-video-poster{opacity:0!important}
#image-to-video .itv-story-video .itv-option-button[hidden]{display:none!important}

#music-generation .cc-music-prompt-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 10px 10px 12px;border:1px solid #e5e0d8;border-radius:12px;background:#fff;color:#211a13;box-shadow:0 10px 28px rgba(35,28,20,.06)}
#music-generation .cc-music-state-pill{flex:none;padding:5px 8px;border-radius:999px;background:#f3f0ea;color:#71685f;font-size:10px;font-weight:700;white-space:nowrap}
#music-generation .cc-music-prompt-text{min-width:0;flex:1;font-size:13px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#music-generation .cc-music-prompt-bar>.cc-local-send{flex:none}
#music-generation .cc-music-prompt-bar>.cc-demo-status{display:none}
#music-generation.cc-music-awaiting .tc-music-board{opacity:.3;filter:saturate(.35);transition:opacity .4s ease,filter .4s ease}
#music-generation.cc-music-awaiting .tc-music-board *{animation-play-state:paused!important}
#music-generation.cc-music-loading .tc-music-board{opacity:.45;filter:saturate(.5);transition:opacity .4s ease,filter .4s ease}
#music-generation.cc-music-generated .tc-music-board{opacity:1;filter:none;transition:opacity .4s ease,filter .4s ease}

@media(max-width:720px){#music-generation .cc-music-prompt-bar{align-items:flex-start;flex-wrap:wrap}#music-generation .cc-music-prompt-text{flex-basis:calc(100% - 98px);white-space:normal}}
@media(prefers-reduced-motion:reduce){.cc-spinner{animation:none!important}#motion-graphics .agentic-thinking-card,#music-generation .tc-music-board,#image-to-video .itv-showcase-img{transition:none!important}}
`;

const PATCH_JS = String.raw`
(() => {
  const DEFAULT_SESSION = { expert:'idle', motion:'idle', transcript:'raw', captions:'idle', image:'source', video:'reference', music:'silent' };
  const session = window.__chatcutDemoSession || { ...DEFAULT_SESSION };
  window.__chatcutDemoSession = session;
  document.documentElement.dataset.ccPlayableVersion = '3';
  const IMAGE_BEFORE_ASSET = 'https://chatcut.io/features/ai-image-generator/cat-white-before.webp';

  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const setState = (key, value) => {
    session[key] = value;
    document.documentElement.dataset.ccDemoSession = JSON.stringify(session);
  };
  const text = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };
  const stopLocal = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  };
  const makeSend = (className, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cc-local-send ' + className;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return b;
  };
  const ensureStatus = (root, key, parent, initial) => {
    let el = q('[data-cc-status="' + key + '"]', root);
    if (!el) {
      el = document.createElement('div');
      el.className = 'cc-demo-status';
      el.dataset.ccStatus = key;
      const host = typeof parent === 'string' ? q(parent, root) : parent;
      if (host) host.append(el);
    }
    if (el && !el.textContent) el.textContent = initial;
    return el;
  };
  const ensureLoading = (container, key, label) => {
    if (!container) return null;
    let el = q('[data-cc-loading="' + key + '"]', container);
    if (!el) {
      el = document.createElement('div');
      el.className = 'cc-generate-overlay';
      el.dataset.ccLoading = key;
      el.innerHTML = '<span class="cc-spinner" aria-hidden="true"></span><span></span>';
      container.append(el);
    }
    text(q('span:last-child', el), label);
    return el;
  };
  const clearLoading = (container, key) => q('[data-cc-loading="' + key + '"]', container)?.remove();

  let expertTimer = 0;
  let expertRaf = 0;
  const startExpertProgress = (root, video, status) => {
    cancelAnimationFrame(expertRaf);
    clearTimeout(expertTimer);
    const started = performance.now();
    const duration = 3600;
    const tick = (now) => {
      if (session.expert !== 'running') return;
      const p = Math.max(0, Math.min(1, (now - started) / duration));
      root.style.setProperty('--bm-playhead-progress', String(p));
      if (p < 1) expertRaf = requestAnimationFrame(tick);
    };
    expertRaf = requestAnimationFrame(tick);
    expertTimer = window.setTimeout(() => {
      if (session.expert !== 'running') return;
      setState('expert', 'done');
      renderExpert();
      text(status, 'Done · first cut updated');
    }, duration + 120);
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.controls = false;
      try { video.currentTime = 0; } catch {}
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  function renderExpert() {
    const root = q('#best-moments');
    if (!root) return;
    root.classList.toggle('cc-expert-awaiting', session.expert === 'idle');
    root.classList.toggle('cc-expert-running', session.expert === 'running');
    root.classList.toggle('cc-expert-done', session.expert === 'done');
    const prompt = q('.bm-prompt-input', root);
    if (prompt && !q('.cc-expert-send', prompt)) prompt.append(makeSend('cc-expert-send', 'Apply editing prompt'));
    prompt?.closest('.bm-prompt-card')?.setAttribute('aria-hidden', 'false');
    const status = ensureStatus(root, 'expert', '.bm-header', 'Paused · send the edit instruction');
    if (session.expert === 'idle') {
      text(status, 'Paused · send the edit instruction');
      const video = q('.bm-final-video', root);
      if (video) { video.pause(); try { if (video.currentTime > .05) video.currentTime = 0; } catch {} }
      root.style.setProperty('--bm-playhead-progress', '0');
    } else if (session.expert === 'running') text(status, 'Playing · finding highlights + adding B-roll');
    else text(status, 'Done · first cut updated');
  }

  function renderMotion() {
    const root = q('#motion-graphics');
    if (!root) return;
    root.classList.toggle('cc-motion-awaiting', session.motion !== 'done');
    root.classList.toggle('cc-motion-generated', session.motion === 'done');
    const dock = q('[data-thread-dock="mg"]', root) || q('.agentic-thinking-static', root);
    const status = ensureStatus(root, 'motion', dock, 'Ready · generate these graphics in place');
    text(status, session.motion === 'done' ? 'Generated · editable motion graphics ready' : 'Ready · generate these graphics in place');
  }

  function renderTranscript() {
    const root = q('#transcript-captions [data-tc-part="edit"]');
    if (!root) return;
    const fillers = qa('.tc-word[data-tc-filler="true"]', root);
    const status = q('#tc-edit-status', root);
    const meta = q('#tc-edit-meta', root);
    const prompt = q('#tc-edit-prompt', root);
    const send = q('#tc-edit-send', root);
    if (send) {
      send.setAttribute('href', '#');
      send.setAttribute('role', 'button');
      send.setAttribute('aria-label', 'Clean up filler words');
    }
    if (session.transcript === 'raw') {
      fillers.forEach(f => f.classList.remove('cc-filler-marked', 'cc-filler-removed'));
      prompt?.classList.remove('tc-prompt-sent');
      text(status, 'Transcript ready'); text(meta, '54 words · 0:43');
    } else if (session.transcript === 'cleaning') {
      prompt?.classList.add('tc-prompt-sent');
      text(status, 'Removing fillers…');
    } else {
      fillers.forEach(f => f.classList.add('cc-filler-removed'));
      prompt?.classList.add('tc-prompt-sent');
      text(status, 'Done — ' + fillers.length + ' fillers removed'); text(meta, '46 words · 0:31');
    }
  }

  function renderCaptions() {
    const root = q('#transcript-captions [data-tc-part="captions"]');
    if (!root) return;
    root.classList.toggle('cc-captions-awaiting', session.captions === 'idle');
    const video = q('#tc-video', root);
    if (!video) return;
    if (video.dataset.ccGateBound !== '1') {
      video.dataset.ccGateBound = '1';
      video.addEventListener('play', () => {
        if (session.captions !== 'idle') return;
        video.pause();
        try { video.currentTime = 0; } catch {}
      });
    }
    if (session.captions === 'idle') {
      video.pause();
      try { if (video.currentTime > .05) video.currentTime = 0; } catch {}
    }
  }

  function renderImage() {
    const root = q('#image-to-video .itv-story:not(.itv-story-video)');
    if (!root) return;
    root.classList.toggle('cc-image-source', session.image === 'source');
    root.classList.toggle('cc-image-loading', session.image === 'loading');
    root.classList.toggle('cc-image-generated', session.image === 'generated');
    const showcase = q('.itv-showcase', root);
    const image = q('.itv-showcase-img', root);
    const status = ensureStatus(root, 'image', '.itv-prompt-shell', 'Source ready · result not generated yet');
    if (image && !image.dataset.ccGeneratedSrc) image.dataset.ccGeneratedSrc = image.currentSrc || image.src;
    if (image && session.image !== 'generated' && image.src !== IMAGE_BEFORE_ASSET) {
      image.src = IMAGE_BEFORE_ASSET;
      image.alt = 'Original source before AI generation';
    }
    if (session.image === 'loading') {
      ensureLoading(showcase, 'image', 'Generating image…');
      text(status, 'Generating image…');
    } else {
      clearLoading(showcase, 'image');
      if (image && session.image === 'generated' && image.dataset.ccGeneratedSrc) {
        image.src = image.dataset.ccGeneratedSrc;
        image.alt = 'Generated image ready for the edit';
      }
      text(status, session.image === 'generated' ? 'Generated · ready to add to the edit' : 'Source ready · result not generated yet');
    }
  }

  function renderVideo() {
    const root = q('#image-to-video .itv-story-video');
    if (!root) return;
    root.classList.toggle('cc-video-awaiting', session.video === 'reference');
    root.classList.toggle('cc-video-loading', session.video === 'loading');
    root.classList.toggle('cc-video-generated', session.video === 'generated');
    const showcase = q('.itv-video-showcase', root);
    const video = q('.itv-showcase-video', root);
    const options = qa('.itv-option-button', root);
    options.forEach((button, index) => {
      button.hidden = index > 0;
      button.setAttribute('aria-hidden', index > 0 ? 'true' : 'false');
      if (index === 0) button.removeAttribute('tabindex');
      else button.setAttribute('tabindex', '-1');
    });
    const status = ensureStatus(root, 'video', '.itv-prompt-shell', 'Reference image ready · video not generated yet');
    if (session.video === 'reference') {
      clearLoading(showcase, 'video');
      if (video) {
        video.pause();
        try { if (video.currentTime > .05) video.currentTime = 0; } catch {}
      }
      text(status, 'Reference image ready · video not generated yet');
    } else if (session.video === 'loading') {
      if (video) video.pause();
      ensureLoading(showcase, 'video', 'Generating video…');
      text(status, 'Generating video from reference…');
    } else {
      clearLoading(showcase, 'video');
      text(status, 'Generated · original preview video loaded');
    }
  }

  function renderMusic() {
    const root = q('#music-generation');
    if (!root) return;
    root.classList.toggle('cc-music-awaiting', session.music === 'silent');
    root.classList.toggle('cc-music-loading', session.music === 'loading');
    root.classList.toggle('cc-music-generated', session.music === 'generated');
    const stack = q('.tc-demo-stack', root);
    const board = q('.tc-music-board', root);
    if (!stack || !board) return;
    let bar = q('.cc-music-prompt-bar', root);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'cc-music-prompt-bar';
      bar.innerHTML = '<span class="cc-music-state-pill">Silent video</span><span class="cc-music-prompt-text">Upbeat lo-fi hip hop, relaxed mood, 90 BPM</span><button type="button" class="cc-local-send cc-music-send" aria-label="Generate royalty-free music"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="cc-demo-status" data-cc-status="music"></div>';
      stack.insertBefore(bar, board);
    }
    const pill = q('.cc-music-state-pill', bar);
    const status = q('[data-cc-status="music"]', bar);
    if (session.music === 'silent') { text(pill, 'Silent video'); text(status, 'Silent video · no music track yet'); }
    else if (session.music === 'loading') { text(pill, 'Generating…'); text(status, 'Generating royalty-free track…'); }
    else { text(pill, 'Music ready'); text(status, 'Generated · waveform + music track ready'); }
  }

  function renderAll() {
    renderExpert(); renderMotion(); renderTranscript(); renderCaptions(); renderImage(); renderVideo(); renderMusic();
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const expertRoot = target.closest('#best-moments');
    if (expertRoot && target.closest('.cc-expert-send')) {
      stopLocal(event);
      setState('expert', 'running');
      renderExpert();
      startExpertProgress(expertRoot, q('.bm-final-video', expertRoot), q('[data-cc-status="expert"]', expertRoot));
      return;
    }

    const motionRoot = target.closest('#motion-graphics');
    if (motionRoot && target.closest('[aria-label="Generate"]')) {
      stopLocal(event);
      setState('motion', 'done');
      renderMotion();
      return;
    }

    const transcriptRoot = target.closest('#transcript-captions [data-tc-part="edit"]');
    if (transcriptRoot && target.closest('#tc-edit-send')) {
      stopLocal(event);
      if (session.transcript !== 'raw') return;
      setState('transcript', 'cleaning');
      renderTranscript();
      const fillers = qa('.tc-word[data-tc-filler="true"]', transcriptRoot);
      fillers.forEach((filler, index) => {
        setTimeout(() => filler.classList.add('cc-filler-marked'), 80 + index * 55);
        setTimeout(() => filler.classList.add('cc-filler-removed'), 240 + index * 55);
      });
      setTimeout(() => { setState('transcript', 'clean'); renderTranscript(); }, 360 + fillers.length * 55);
      return;
    }

    const captionsRoot = target.closest('#transcript-captions [data-tc-part="captions"]');
    if (captionsRoot && target.closest('.tc-style-item,#tc-style-prev,#tc-style-next,.tc-video-card')) {
      if (session.captions === 'idle') setState('captions', 'playing');
      renderCaptions();
      const video = q('#tc-video', captionsRoot);
      if (video) {
        video.muted = true;
        video.playsInline = true;
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      return;
    }

    const imageRoot = target.closest('#image-to-video .itv-story:not(.itv-story-video)');
    if (imageRoot && target.closest('.itv-send-btn,[aria-label="Generate"]')) {
      stopLocal(event);
      if (session.image === 'loading') return;
      setState('image', 'loading'); renderImage();
      setTimeout(() => { setState('image', 'generated'); renderImage(); }, 850);
      return;
    }
    if (imageRoot && target.closest('.itv-option-button')) {
      setTimeout(() => { setState('image', 'source'); renderImage(); }, 0);
      return;
    }

    const videoRoot = target.closest('#image-to-video .itv-story-video');
    if (videoRoot && target.closest('.itv-send-btn,[aria-label="Generate"]')) {
      stopLocal(event);
      if (session.video === 'loading') return;
      setState('video', 'loading'); renderVideo();
      setTimeout(() => {
        setState('video', 'generated'); renderVideo();
        const video = q('.itv-showcase-video', videoRoot);
        if (video) {
          video.muted = true; video.playsInline = true;
          try { video.currentTime = 0; } catch {}
          const p = video.play(); if (p && typeof p.catch === 'function') p.catch(() => { video.controls = true; });
        }
      }, 950);
      return;
    }
    if (videoRoot && target.closest('.itv-option-button')) {
      const options = qa('.itv-option-button', videoRoot);
      if (target.closest('.itv-option-button') !== options[0]) {
        stopLocal(event);
        return;
      }
      setTimeout(() => { setState('video', 'reference'); renderVideo(); }, 0);
      return;
    }

    const musicRoot = target.closest('#music-generation');
    if (musicRoot && target.closest('.cc-music-send')) {
      stopLocal(event);
      if (session.music === 'loading') return;
      setState('music', 'loading'); renderMusic();
      setTimeout(() => { setState('music', 'generated'); renderMusic(); }, 850);
    }
  }

  let queued = false;
  const scheduleRender = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; renderAll(); });
  };

  function boot() {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('astro:page-load', renderAll);
    new MutationObserver(scheduleRender).observe(document.documentElement, { childList:true, subtree:true });
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
`;

function absoluteize(html) {
  const attrs = ['href','src','poster','component-url','renderer-url','before-hydration-url'];
  for (const attr of attrs) {
    const re = new RegExp(`(${attr}\\s*=\\s*["'])(/(?!/)[^"']*)(["'])`, 'gi');
    html = html.replace(re, (_m,a,p,z) => `${a}${ORIGIN}${p}${z}`);
  }
  html = html.replace(/url\(\s*(["']?)(\/(?!\/)[^"')]+)\1\s*\)/gi, (_m,q,p)=>`url(${q}${ORIGIN}${p}${q})`);
  html = html.replace(/(&quot;)(\/(?!\/)[^&<>\s]*?)(?=&quot;)/g, (_m,q,p)=>`${q}${ORIGIN}${p}`);
  html = html.replace(/(["'])(\/(?!\/)[A-Za-z0-9._~!$&()*+,;=:@%/?#-]*)(\1)/g, (_m,q,p)=>`${q}${ORIGIN}${p}${q}`);
  return html;
}

function stripTracking(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => /googletagmanager|google-analytics|posthog|ahrefs|firstpromoter|cloudflareinsights|beacon\.min\.js/i.test(tag) ? '' : tag);
}

async function fetchPage(url) {
  const r = await fetch(url, {
    redirect:'follow',
    headers:{'user-agent':'Mozilla/5.0 ChatCutPlayableMirror/3.0','accept':'text/html,application/xhtml+xml'}
  });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} ${url}`);
  return r.text();
}

const REQUIRED_HOME_SURFACES = ['id="best-moments"','id="transcript-captions"','id="image-to-video"','id="music-generation"'];
function hasHomepageContract(html) {
  return REQUIRED_HOME_SURFACES.every(required => html.includes(required));
}
function stripPreviousPlayableLayer(html) {
  return html
    .replace(/<style\s+data-cc-playable-patch>[\s\S]*?<\/style>/gi, '')
    .replace(/<style\s+data-cc-playable-layer-fix>[\s\S]*?<\/style>/gi, '')
    .replace(/<style\s+data-cc-playable-visual-fix>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\s+data-cc-playable-patch>[\s\S]*?<\/script>/gi, '')
    .replace(/<meta\s+name="cc-runtime-localized"[^>]*>/gi, '')
    .replace(/<meta\s+data-cc-playable-island-safe[^>]*>/gi, '')
    .replace(/<meta\s+data-cc-playable-hydration-safe[^>]*>/gi, '');
}

// Fail in CI before publishing if the injected patch itself is syntactically invalid.
new Function(PATCH_JS);

await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(OUT,{recursive:true});
let html = await fetchPage(`${ORIGIN}/`);
let source = 'production';
if (!hasHomepageContract(html)) {
  console.warn('[build] current production variant does not expose the reviewed ChatCut demo surfaces; using immutable verified fallback');
  html = stripPreviousPlayableLayer(await fetchPage(VERIFIED_FALLBACK));
  source = 'verified-fallback';
}
for (const required of REQUIRED_HOME_SURFACES) {
  if (!html.includes(required)) throw new Error(`Homepage contract changed: missing ${required}`);
}
html = stripTracking(absoluteize(html));
html = html.replace(/<html([^>]*)>/i, (match, attrs) => {
  if (/data-cc-mirror-source=/.test(attrs)) return match;
  return `<html${attrs} data-cc-mirror-source="${source}">`;
});
html = html.replace(/<link\s+href="\/"\s+rel="canonical">/i, `<link href="${ORIGIN}/" rel="canonical">`);
html = html.replace(/<\/head\s*>/i, `<style data-cc-playable-patch>${PATCH_CSS}</style></head>`);
html = html.replace(/<\/body\s*>/i, `<script data-cc-playable-patch>${PATCH_JS.replace(/<\/script/gi,'<\\/script')}</script></body>`);
await fs.writeFile(path.join(OUT,'index.html'),html,'utf8');
await fs.writeFile(path.join(OUT,'intent.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatCut playable intent</title><style>body{font-family:Inter,system-ui;margin:0;background:#fcfbfd;color:#211a13}main{max-width:900px;margin:auto;padding:64px 24px}h1{font-size:clamp(40px,7vw,72px);line-height:.98}p{font-size:20px;line-height:1.55;color:#6b6256}.card{margin-top:28px;padding:24px;border:1px solid #e5e0d8;border-radius:18px;background:#fff}</style><main><h1>Copy first. Edit second.</h1><p>Production ChatCut homepage is fetched at build time. Original layout, CSS, scripts, images and videos stay authoritative. The patch only turns existing demos into local cause→effect interactions.</p><div class="card">Send → original Best Moments cut advances · Transcript → filler words visibly disappear · Generate image/video/music → the original result state appears in place.</div></main>','utf8');
await fs.writeFile(path.join(OUT,'.nojekyll'),'','utf8');
console.log(JSON.stringify({ok:true,bytes:Buffer.byteLength(html),out:OUT,patchVersion:2},null,2));
