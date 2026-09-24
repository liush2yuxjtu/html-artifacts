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
  window.ccV3 = { session, log, version: 'v3-2026-09-24' };
  const note = (flow, state) => { session[flow] = state; log.push(`${flow}:${state}`); };

  const COPY = {
    editorIdle: 'Press Send to run this edit',
    editorRunning: 'Running the original ChatCut edit…',
    editorDone: 'Original ChatCut edit is on the timeline',
    agentIdle: 'Press Send in the agent window to start',
    agentRunning: 'Agent is working through the original ChatCut run…',
    agentDone: 'Original run finished · the cut opens in ChatCut',
  };

  // One status line per flow. While a flow is held it also carries a
  // full-size Send button: inside the scaled product mocks the native Send is
  // only a few pixels wide on phones. Both trigger the same single action.
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
    const cta = el.querySelector('.cc3-cta');
    cta.setAttribute('data-cc3-send', flow);
    cta.hidden = state !== 'idle';
    el.dataset.state = state;
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
    const send = root.querySelector('.fe-send');
    if (composer && !composer.querySelector('.cc3-editor-prompt')) {
      const p = document.createElement('p');
      p.className = 'cc3-editor-prompt';
      p.textContent = editorPrompt(root);
      composer.appendChild(p);
    }
    if (send && !send.hasAttribute('data-cc3-send')) {
      send.setAttribute('data-cc3-send', 'editor');
      send.setAttribute('role', 'button');
      send.setAttribute('tabindex', '0');
      send.setAttribute('aria-label', 'Send prompt');
    }
    if (awaiting) pauseNativeVideo(root);
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
        send.setAttribute('data-cc3-send', agent.flow);
        // Production ships Send disabled because the homepage skipped straight
        // to the finished run. It is the one trigger while the run is held.
        if (awaiting) send.disabled = false;
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
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.matches('[data-cc3-send="editor"]')) trigger(event);
  }, true);

  let queued = false;
  function ensureAll() {
    queued = false;
    ensureEditor();
    ensureAgents();
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(ensureAll); } };
  // React islands hydrate and re-render after this runs; keep the gate in place.
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-home-demo-mode', 'hidden', 'aria-label', 'disabled', 'ssr'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureAll); else ensureAll();
})();
