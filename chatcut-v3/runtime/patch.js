// ChatCut v3 playable patch.
//
// Contract: original state → one visitor action → the original ChatCut result
// continues in place. Nothing here fabricates output: B01 reveals the edit the
// production demo already contains, B02 replays the production agent timeline
// through its own `cxwin:play` / `ccr:play` events. No network requests.
(() => {
  if (window.ccV3) return;
  const session = { editor: 'idle', codex: 'idle', claude: 'idle' };
  const log = [];
  window.ccV3 = { session, log, version: 'v3.1-2026-09-25-b01-video-overlay' };
  const note = (flow, state) => { session[flow] = state; log.push(`${flow}:${state}`); };

  const COPY = {
    editorIdle: 'Press Send to run this edit',
    editorRunning: 'Running the original ChatCut edit…',
    editorDone: 'Original ChatCut edit is on the timeline',
    agentIdle: 'Press Send in the agent window to start',
    agentRunning: 'Agent is working through the original ChatCut run…',
    agentDone: 'Original run finished · the cut opens in ChatCut',
  };

  // One status line per flow. For B02 a held flow also carries a full-size
  // Send button (the agent window's own Send is tiny on phones). B01 uses the
  // overlay on its video instead; its status-line Send is only a fallback for
  // when the video cannot be found.
  function status(host, anchor, text, state, flow) {
    if (!host) return;
    let el = host.querySelector(':scope .cc3-status[data-for="' + anchor + '"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cc3-status';
      el.dataset.for = anchor;
      el.innerHTML = '<span class="cc3-status-text" role="status" aria-live="polite"></span><button type="button" class="cc3-cta">Send<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      host.appendChild(el);
    }
    const label = el.querySelector('.cc3-status-text');
    if (label.textContent !== text) label.textContent = text;
    // Write only real changes: the MutationObserver below watches `hidden`,
    // and a same-value write still queues a record (a per-frame loop).
    const cta = el.querySelector('.cc3-cta');
    if (cta.getAttribute('data-cc3-send') !== flow) cta.setAttribute('data-cc3-send', flow);
    const hide = state !== 'idle' || (flow === 'editor' && overlayAnchored);
    if (cta.hidden !== hide) cta.hidden = hide;
    if (el.dataset.state !== state) el.dataset.state = state;
  }

  // ---------- B01 · hero editor demo ----------
  const editorSection = () => document.getElementById('editor-demo');
  const creatorRoot = () => editorSection()?.querySelector('[data-home-demo-mode="creator"]');

  function editorPrompt(root) {
    // The production user bubble starts with the prompt as a bare text node,
    // followed by the uploaded-file chip.
    const bubble = root.querySelector('.fe-user');
    const text = bubble ? [...bubble.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(' ') : '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // Touching the island before React hydrates it causes a hydration mismatch
  // (React #418). Astro drops the `ssr` attribute when it *starts* hydrating,
  // but React commits later in a transition; the committed DOM nodes carry a
  // __reactFiber$ key, so wait for that on the composer we are about to edit.
  const hydrated = root => {
    const composer = root.querySelector('.fe-composer');
    return !!composer && Object.keys(composer).some(k => k.startsWith('__reactFiber$'));
  };

  function pauseNativeVideo(root) {
    const btn = root.querySelector('.fe-tltb button[aria-label="Pause video"]');
    if (btn) btn.click();
  }

  function playNativeVideo(root) {
    const btn = root.querySelector('.fe-tltb button[aria-label="Play video"]');
    if (btn) btn.click();
  }

  function ensureEditor() {
    const section = editorSection();
    const root = creatorRoot();
    if (!section || !root) return;
    const awaiting = session.editor === 'idle';
    section.classList.toggle('cc3-editor-awaiting', awaiting);
    const text = { idle: COPY.editorIdle, running: COPY.editorRunning, done: COPY.editorDone }[session.editor];
    status(section, 'editor', text, session.editor, 'editor');
    // Hydration reuses the SSR nodes without DOM mutations, so poll until done.
    if (!hydrated(root)) { setTimeout(schedule, 200); return; }
    const composer = root.querySelector('.fe-composer');
    if (composer && !composer.querySelector('.cc3-editor-prompt')) {
      const p = document.createElement('p');
      p.className = 'cc3-editor-prompt';
      p.textContent = editorPrompt(root);
      composer.appendChild(p);
    }
    placeVideoOverlay(section, root, awaiting);
    if (awaiting) pauseNativeVideo(root);
  }

  // B01's single trigger: a real <button> laid over the demo's video footage
  // (.hve-viewer). Clicking anywhere on the held video runs the edit. It sits
  // on the section, outside the React island, so re-renders cannot remove it
  // and hydration stays clean; it is re-aligned to the viewer's rect on every
  // resize, re-fit (the mock is scaled with a CSS transform) and re-render.
  // If the viewer cannot be found the status line's Send appears instead.
  let overlayAnchored = false;
  let watchedFit = null;
  function placeVideoOverlay(section, root, show) {
    let btn = section.querySelector(':scope > .cc3-video-overlay');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc3-video-overlay';
      btn.setAttribute('data-cc3-send', 'editor');
      btn.setAttribute('aria-label', 'Send the prompt and run this edit');
      btn.innerHTML = '<span class="cc3-video-overlay-pill" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>Send · Run this edit</span>';
      section.appendChild(btn);
    }
    const fit = root && root.querySelector('.es-scaled');
    if (fit && fit !== watchedFit) {
      watchedFit = fit;
      new MutationObserver(schedule).observe(fit, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    const viewer = root && root.querySelector('.hve-viewer');
    const r = viewer && viewer.getBoundingClientRect();
    overlayAnchored = !!(r && r.width > 0 && r.height > 0);
    const visible = show && overlayAnchored;
    if (btn.hidden !== !visible) btn.hidden = !visible;
    if (!visible) return;
    const s = section.getBoundingClientRect();
    const box = [r.left - s.left, r.top - s.top, r.width, r.height].map(v => Math.round(v * 10) / 10);
    const pos = box.join(',');
    if (btn.dataset.pos === pos) return;
    btn.dataset.pos = pos;
    btn.style.left = `${box[0]}px`;
    btn.style.top = `${box[1]}px`;
    btn.style.width = `${box[2]}px`;
    btn.style.height = `${box[3]}px`;
  }

  function runEditor() {
    if (session.editor !== 'idle') return;
    const root = creatorRoot();
    note('editor', 'running');
    ensureEditor();
    if (root) playNativeVideo(root);
    setTimeout(() => { note('editor', 'done'); ensureEditor(); }, 2600);
  }

  // ---------- B02 · agent panels ----------
  const AGENTS = [
    { flow: 'codex', selector: '[data-cxwin]', event: 'cxwin:play', panel: '#had-codex-panel' },
    { flow: 'claude', selector: '[data-ccr]', event: 'ccr:play', panel: '#had-claude-panel' },
  ];

  function agentStatusHost() {
    const connect = document.getElementById('connect');
    if (!connect) return null;
    const heading = [...connect.querySelectorAll('h3,h4,p,div')].find(el => el.children.length === 0 && el.textContent.trim() === 'Connect to your agent');
    return heading?.parentElement || connect;
  }

  function ensureAgents() {
    const host = agentStatusHost();
    let shown = null;
    for (const agent of AGENTS) {
      const el = document.querySelector(agent.selector);
      if (!el) continue;
      const awaiting = session[agent.flow] === 'idle';
      el.classList.toggle('cc3-agent-awaiting', awaiting);
      const send = el.querySelector('button[aria-label="Send"]');
      if (send) {
        if (send.getAttribute('data-cc3-send') !== agent.flow) send.setAttribute('data-cc3-send', agent.flow);
        // Production ships Send disabled because the homepage skipped straight
        // to the finished run. It is the one trigger while the run is held.
        if (awaiting && send.disabled) send.disabled = false;
      }
      const panel = document.querySelector(agent.panel);
      if (panel && !panel.hidden) shown = agent.flow;
    }
    const flow = shown || 'codex';
    const state = session[flow];
    // The ChatCut editor next to the agent is the run's destination: keep it
    // pending until the agent has actually finished (class sits outside the
    // React island, so hydration is untouched).
    document.querySelector('#connect .had-workspace')?.classList.toggle('cc3-agent-pending', state !== 'done');
    const text = { idle: COPY.agentIdle, running: COPY.agentRunning, done: COPY.agentDone }[state];
    status(host, 'agent', text, state, flow);
  }

  function runAgent(flow) {
    const agent = AGENTS.find(a => a.flow === flow);
    const el = agent && document.querySelector(agent.selector);
    if (!el || session[flow] !== 'idle') return;
    note(flow, 'running');
    el.dispatchEvent(new CustomEvent(agent.event));
    ensureAgents();
    // Mark done when the production component itself reports completion.
    const finished = () => (flow === 'claude'
      ? el.dataset.phase === 'done'
      : [...el.querySelectorAll('[data-astep]')].every(step => step.dataset.state === 'done' && step.style.opacity === '1'));
    const started = Date.now();
    const timer = setInterval(() => {
      if (finished() || Date.now() - started > 30000) { clearInterval(timer); note(flow, 'done'); ensureAgents(); }
    }, 250);
  }

  // ---------- wiring ----------
  function trigger(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-cc3-send]') : null;
    if (!target) return;
    const flow = target.getAttribute('data-cc3-send');
    if (flow === 'editor' && session.editor === 'idle') {
      event.preventDefault(); event.stopPropagation(); runEditor();
    } else if ((flow === 'codex' || flow === 'claude') && session[flow] === 'idle') {
      event.preventDefault(); event.stopPropagation(); runAgent(flow);
    }
  }
  document.addEventListener('click', trigger, true);

  let queued = false;
  function ensureAll() {
    queued = false;
    ensureEditor();
    ensureAgents();
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(ensureAll); } };
  // React islands hydrate and re-render after this runs; keep the gate in place.
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-home-demo-mode', 'hidden', 'aria-label', 'disabled', 'ssr'] });
  // The overlay tracks the product's Send, which moves when the mock re-fits.
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  if ('ResizeObserver' in window) {
    const watch = () => { const s = editorSection(); if (s) new ResizeObserver(schedule).observe(s); else setTimeout(watch, 200); };
    watch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureAll); else ensureAll();
})();
