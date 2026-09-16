import { createDemoSession, transitionDemo } from './demo-session.js';

export const PRODUCTION_SELECTORS = Object.freeze({
  bestMoments: '#best-moments',
  bestMomentsVideo: '.bm-final-video',
  motion: '#motion-graphics',
  transcript: '#transcript-captions [data-tc-part="edit"]',
  captions: '#transcript-captions [data-tc-part="captions"]',
  imageStory: '#image-to-video .itv-story:not(.itv-story-video)',
  videoStory: '#image-to-video .itv-story-video',
  music: '#music-generation',
});

export const IMAGE_BEFORE_ASSET = 'https://chatcut.io/features/ai-image-generator/cat-white-before.webp';
export const MUSIC_PROMPT = 'Upbeat lo-fi hip hop, relaxed mood, 90 BPM';
export const MUSIC_SOURCE_VIDEO = 'https://cdn.chatcut.dev/landing-hero/transcript-captions/project-caption-timeline.mp4';

function setSession(action) {
  window.__chatcutDemoSession = transitionDemo(window.__chatcutDemoSession, { type: action });
  document.documentElement.dataset.ccDemoSession = JSON.stringify(window.__chatcutDemoSession);
  return window.__chatcutDemoSession;
}

function makeStatus(text) {
  const el = document.createElement('div');
  el.className = 'cc-demo-status';
  el.textContent = text;
  return el;
}

function makeSendButton(label = 'Send') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cc-local-send';
  button.setAttribute('aria-label', label);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return button;
}

function addLoadingOverlay(container, text) {
  const overlay = document.createElement('div');
  overlay.className = 'cc-generate-overlay';
  overlay.innerHTML = `<span class="cc-spinner" aria-hidden="true"></span><span>${text}</span>`;
  container.append(overlay);
  return overlay;
}

function bindBestMoments() {
  const root = document.querySelector(PRODUCTION_SELECTORS.bestMoments);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.classList.add('cc-expert-awaiting');
  root.setAttribute('data-cc-demo', 'expert');

  const video = root.querySelector(PRODUCTION_SELECTORS.bestMomentsVideo);
  const promptInput = root.querySelector('.bm-prompt-input');
  if (!video || !promptInput) return;

  video.pause();
  try { video.currentTime = 0; } catch {}
  const keepPaused = () => {
    if (window.__chatcutDemoSession?.expert === 'idle') {
      video.pause();
      if (video.currentTime > 0.05) video.currentTime = 0;
    }
  };
  video.addEventListener('play', keepPaused);

  const send = makeSendButton('Apply editing prompt');
  promptInput.append(send);
  promptInput.closest('.bm-prompt-card')?.setAttribute('aria-hidden', 'false');
  const status = makeStatus('Paused · send the edit instruction');
  root.querySelector('.bm-header')?.append(status);

  const updateProgress = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const progress = Math.max(0, Math.min(1, video.currentTime / video.duration));
    root.style.setProperty('--bm-playhead-progress', String(progress));
    if (progress >= 0.9 && window.__chatcutDemoSession.expert === 'running') {
      setSession('EXPERT_DONE');
      status.textContent = 'Done · first cut updated';
    }
  };
  video.addEventListener('timeupdate', updateProgress);

  send.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    root.classList.remove('cc-expert-awaiting');
    root.classList.add('cc-expert-running');
    setSession('EXPERT_START');
    status.textContent = 'Playing · finding highlights + adding B-roll';
    try { video.currentTime = 0; } catch {}
    video.play().catch(() => {
      status.textContent = 'Click the video to continue playback';
      video.controls = true;
    });
  });
}

function bindMotion() {
  const root = document.querySelector(PRODUCTION_SELECTORS.motion);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.classList.add('cc-motion-awaiting');
  root.setAttribute('data-cc-demo', 'motion');

  const status = makeStatus('Ready · generate these graphics in place');
  const dock = root.querySelector('[data-thread-dock="mg"]') || root.querySelector('.agentic-thinking-static');
  dock?.append(status);

  root.addEventListener('click', (event) => {
    const link = event.target.closest('a[aria-label="Generate"], a[data-utm-link][href*="target=motion-graphics"]');
    if (!link || !root.contains(link)) return;
    event.preventDefault();
    event.stopPropagation();
    root.classList.remove('cc-motion-awaiting');
    root.classList.add('cc-motion-generated');
    setSession('MOTION_GENERATE');
    status.textContent = 'Generated · editable motion graphics ready';
  }, true);
}

function bindTranscript() {
  const root = document.querySelector(PRODUCTION_SELECTORS.transcript);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.setAttribute('data-cc-demo', 'transcript');

  const fillers = [...root.querySelectorAll('.tc-word[data-tc-filler="true"]')];
  const send = root.querySelector('#tc-edit-send');
  const status = root.querySelector('#tc-edit-status');
  const meta = root.querySelector('#tc-edit-meta');
  const prompt = root.querySelector('#tc-edit-prompt');
  if (!fillers.length || !send) return;

  for (const filler of fillers) filler.classList.remove('tc-collapsed');
  prompt?.classList.remove('tc-prompt-sent');
  if (status) status.textContent = 'Transcript ready';
  if (meta) meta.textContent = '54 words · 0:43';

  send.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.__chatcutDemoSession.transcript !== 'raw') return;
    setSession('TRANSCRIPT_START');
    prompt?.classList.add('tc-prompt-sent');
    if (status) status.textContent = 'Removing fillers…';

    fillers.forEach((filler, index) => {
      setTimeout(() => filler.classList.add('tc-collapsed'), 100 + index * 85);
    });
    setTimeout(() => {
      setSession('TRANSCRIPT_DONE');
      if (status) status.textContent = `Done — ${fillers.length} fillers removed`;
      if (meta) meta.textContent = '46 words · 0:31';
    }, 180 + fillers.length * 90);
  }, true);
}

function bindImageGeneration() {
  const root = document.querySelector(PRODUCTION_SELECTORS.imageStory);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.classList.add('cc-image-source');
  root.setAttribute('data-cc-demo', 'image');

  const showcase = root.querySelector('.itv-showcase');
  const image = root.querySelector('.itv-showcase-img');
  const generate = root.querySelector('.itv-send-btn, a[aria-label="Generate"]');
  if (!showcase || !image || !generate) return;
  const generatedSrc = image.currentSrc || image.src;
  image.dataset.ccGeneratedSrc = generatedSrc;
  image.src = IMAGE_BEFORE_ASSET;
  image.alt = 'Original source before AI generation';

  const status = makeStatus('Source image · result not generated yet');
  root.querySelector('.itv-prompt-shell')?.append(status);

  generate.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.__chatcutDemoSession.image === 'loading') return;
    setSession('IMAGE_START');
    root.classList.add('cc-image-loading');
    status.textContent = 'Generating image…';
    const overlay = addLoadingOverlay(showcase, 'Generating image…');
    setTimeout(() => {
      image.src = image.dataset.ccGeneratedSrc || generatedSrc;
      image.alt = 'Generated image ready for the edit';
      overlay.remove();
      root.classList.remove('cc-image-source', 'cc-image-loading');
      root.classList.add('cc-image-generated');
      setSession('IMAGE_DONE');
      status.textContent = 'Generated · ready to add to the edit';
    }, 850);
  }, true);
}

function bindVideoGeneration() {
  const root = document.querySelector(PRODUCTION_SELECTORS.videoStory);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.classList.add('cc-video-awaiting');
  root.setAttribute('data-cc-demo', 'video');

  const showcase = root.querySelector('.itv-video-showcase');
  const video = root.querySelector('.itv-showcase-video');
  const reference = root.querySelector('.itv-reference-card img');
  const generate = root.querySelector('.itv-send-btn, a[aria-label="Generate"]');
  if (!showcase || !video || !reference || !generate) return;

  const referenceOverlay = document.createElement('img');
  referenceOverlay.className = 'cc-video-reference-overlay';
  referenceOverlay.src = reference.currentSrc || reference.src;
  referenceOverlay.alt = 'Selected reference image waiting to become video';
  showcase.append(referenceOverlay);

  video.pause();
  const keepPaused = () => {
    if (window.__chatcutDemoSession.video === 'reference') video.pause();
  };
  video.addEventListener('play', keepPaused);

  const status = makeStatus('Reference image ready · video not generated yet');
  root.querySelector('.itv-prompt-shell')?.append(status);

  generate.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.__chatcutDemoSession.video === 'loading') return;
    setSession('VIDEO_START');
    status.textContent = 'Generating video from reference…';
    const overlay = addLoadingOverlay(showcase, 'Generating video…');
    setTimeout(() => {
      overlay.remove();
      referenceOverlay.remove();
      root.classList.remove('cc-video-awaiting');
      root.classList.add('cc-video-generated');
      setSession('VIDEO_DONE');
      status.textContent = 'Generated · original preview video loaded';
      try { video.currentTime = 0; } catch {}
      video.play().catch(() => { video.controls = true; });
    }, 950);
  }, true);
}

function bindMusic() {
  const root = document.querySelector(PRODUCTION_SELECTORS.music);
  if (!root || root.dataset.ccPatchBound === '1') return;
  root.dataset.ccPatchBound = '1';
  root.classList.add('cc-music-awaiting');
  root.setAttribute('data-cc-demo', 'music');

  const demoStack = root.querySelector('.tc-demo-stack');
  const board = root.querySelector('.tc-music-board');
  if (!demoStack || !board) return;

  const sourceRow = document.createElement('div');
  sourceRow.className = 'cc-music-source-row';
  sourceRow.innerHTML = `
    <div class="cc-music-source-video">
      <video muted loop playsinline preload="metadata" src="${MUSIC_SOURCE_VIDEO}"></video>
      <span class="cc-audio-badge">Silent video</span>
    </div>
    <div class="cc-music-prompt-card">
      <div class="cc-music-prompt-label">Prompt</div>
      <div class="cc-music-prompt-text">${MUSIC_PROMPT}</div>
      <button type="button" class="cc-local-send cc-music-send" aria-label="Generate royalty-free music"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="cc-demo-status">Silent source · no music track yet</div>
    </div>`;
  demoStack.insertBefore(sourceRow, board);
  const sourceVideo = sourceRow.querySelector('video');
  const badge = sourceRow.querySelector('.cc-audio-badge');
  const send = sourceRow.querySelector('.cc-music-send');
  const status = sourceRow.querySelector('.cc-demo-status');
  sourceVideo?.play().catch(() => {});

  send.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.__chatcutDemoSession.music === 'loading') return;
    setSession('MUSIC_START');
    root.classList.add('cc-music-loading');
    status.textContent = 'Generating royalty-free track…';
    badge.textContent = 'Generating music…';
    setTimeout(() => {
      root.classList.remove('cc-music-awaiting', 'cc-music-loading');
      root.classList.add('cc-music-generated');
      setSession('MUSIC_DONE');
      badge.textContent = 'Music track ready';
      status.textContent = 'Generated · waveform + music asset ready';
    }, 850);
  });
}

function bindAll() {
  if (!window.__chatcutDemoSession) window.__chatcutDemoSession = createDemoSession();
  bindBestMoments();
  bindMotion();
  bindTranscript();
  // Captions intentionally keep the production behavior unchanged.
  bindImageGeneration();
  bindVideoGeneration();
  bindMusic();
}

function boot() {
  bindAll();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      bindAll();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('astro:page-load', bindAll);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
