"use strict";

// 所有回复来自本地模板。用户输入只以文本节点显示，不发送网络请求。
(() => {
  const $ = (selector) => document.querySelector(selector);
  const smallScreen = matchMedia("(max-width: 860px)");
  const overlayScreen = matchMedia("(max-width: 1179px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scenarios = {
    artifact: {
      prompt: "Create a four-step validation plan for an AI teammate that turns meeting notes into clear next steps.",
      title: "Product validation plan",
      heading: "From a promising idea to useful evidence.",
      intro: "Let’s make the idea concrete. This local example turns the brief into four decisions, each with something you can test. The finished artifact will open automatically.",
      lede: "A practical plan for an AI teammate that turns messy meeting notes into clear, verifiable next steps.",
      summary: "Four stages, one observable outcome at each. Start with the job, finish with evidence.",
      status: "Validation plan ready",
      sections: [
        ["Name the job", "Help a team leave a meeting knowing what happens next. The first outcome is a short action list with an owner for every task.", "One clear user outcome"],
        ["Make one action real", "Let someone paste a sample note and turn it into a task list. Keep the interaction small enough to understand without a tutorial.", "A task someone can try"],
        ["Show the evidence", "Display the original note beside the proposed actions. Ask the user to correct an owner or a deadline so the result can be judged, not just admired.", "An inspectable result"],
        ["Test before expanding", "Try the same task with three teammates. Observe whether they can find the next action and fix a mistake without help. Improve the weak step before adding features.", "A repeatable behavior test"]
      ]
    },
    brief: {
      prompt: "Write a one-page product brief for an AI teammate that turns messy notes into a clear action list.",
      title: "One-page product brief",
      heading: "Less meeting cleanup. More forward motion.",
      intro: "Here is a local product-brief example: a specific audience, one useful promise, and a small first release. The artifact makes the scope easy to question.",
      lede: "An AI teammate for small teams that need a trustworthy action list, not another meeting transcript.",
      summary: "Audience, promise, first release, and success criteria in one readable document.",
      status: "Product brief ready",
      sections: [
        ["Who it helps", "Team leads who currently reread meeting notes and send follow-up messages to work out who owns each action.", "A specific audience"],
        ["The product promise", "Turn a pasted note into proposed actions, owners, and open questions. Clearly label missing details rather than inventing an answer.", "One honest promise"],
        ["The first release", "Support pasted text, an editable task list, and a downloadable summary. Leave integrations, live recording, and team permissions out of this first test.", "A deliberately small scope"],
        ["How to judge it", "Measure whether a teammate can check the actions and correct a mistake faster than doing the cleanup manually. A compliment is not a completed task.", "Behavior, not praise"]
      ]
    },
    risks: {
      prompt: "Review a fictional launch plan for a meeting-notes assistant. Identify the three biggest risks and a cheap way to test each.",
      title: "Launch risk review",
      heading: "Find the fragile assumptions first.",
      intro: "This fictional risk review separates three assumptions from the evidence needed to trust them. It is a local template, not an analysis of real company data.",
      lede: "Three practical risks for a meeting-notes assistant, ordered by what would make a launch fail.",
      summary: "Three risks with a visible signal and a concrete test for each.",
      status: "Risk review ready",
      sections: [
        ["Wrong owners look convincing", "Risk: a plausible task is assigned to the wrong person. Signal: reviewers repeatedly correct ownership. Test: compare extracted actions with five human-checked sample notes.", "Trust and correctness"],
        ["The workflow adds more work", "Risk: checking the output takes longer than writing the list. Signal: users return to their old notes. Test: observe three people complete the same cleanup task both ways.", "Actual time saved"],
        ["Sensitive notes are shared too widely", "Risk: users cannot tell where notes go. Signal: they hesitate or paste private data into the wrong place. Test: use fictional notes and ask users to explain the data boundary before a real pilot.", "A clear data boundary"]
      ]
    }
  };
  const examples = [
    { id: "example-artifact", title: "Product validation plan", key: "artifact", example: true },
    { id: "example-brief", title: "One-page product brief", key: "brief", example: true },
    { id: "example-risks", title: "Launch risk review", key: "risks", example: true }
  ];
  const state = { model: "Sonnet", busy: false, current: null, artifactOpen: false, menuOpen: false, sessions: [], sequence: 0, nextId: 1, attachmentSequence: 0 };
  let timers = [];
  let artifactReturnFocus = null;
  const ui = Object.fromEntries([
    "sidebar", "chatPane", "scrim", "mobileMenuButton", "closeNavigation", "newChatBtn", "conversationSearch", "clearSearch", "historyList", "emptySearch", "searchStatus", "chatsNav", "artifactsNav", "artifactCount", "artifactNavHint", "welcome", "thread", "userPrompt", "assistantIntro", "modelLabel", "modelSelect", "activity", "statusText", "resultCard", "resultTitle", "resultSummary", "resultGrid", "retryButton", "composerForm", "composerInput", "sendButton", "sendLabel", "sendIcon", "inputError", "attachmentStatus", "attachButton", "notesFile", "artifactPanel", "artifactTitle", "artifactHeading", "artifactLede", "artifactSteps", "artifactModel", "closeArtifact", "openArtifactButton", "downloadArtifact", "announcer", "conversationScroll", "artifactScroll"
  ].map((id) => [id, document.getElementById(id)]));

  function say(message) { ui.announcer.textContent = message; }
  function status(message, phase) {
    ui.statusText.textContent = message;
    ui.activity.dataset.state = phase;
    ui.activity.dataset.busy = String(state.busy);
  }
  function modelLabels() {
    const label = `${state.model} · simulated`;
    ui.modelLabel.textContent = label;
    ui.artifactModel.textContent = label;
    if (state.current) state.current.model = state.model;
  }
  function syncSend() {
    ui.sendButton.disabled = !state.busy && !ui.composerInput.value.trim();
    ui.sendLabel.textContent = state.busy ? "Stop" : "Send";
    ui.sendIcon.hidden = state.busy;
    ui.sendButton.setAttribute("aria-label", state.busy ? "Stop local generation" : "Send message");
  }
  function navState() {
    const ready = state.current?.phase === "ready";
    ui.artifactsNav.disabled = !ready;
    ui.artifactCount.textContent = ready ? "1" : "0";
    ui.artifactNavHint.textContent = ready ? "Your current artifact is ready to inspect." : "Create an artifact to open it here.";
    for (const [button, active] of [[ui.chatsNav, !state.artifactOpen], [ui.artifactsNav, state.artifactOpen]]) {
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    }
  }
  function modalTarget() {
    if (state.artifactOpen && overlayScreen.matches) return ui.artifactPanel;
    if (state.menuOpen && smallScreen.matches) return ui.sidebar;
    return null;
  }
  function applyOverlayState() {
    const target = modalTarget();
    ui.scrim.hidden = !target;
    ui.chatPane.inert = !!target;
    ui.sidebar.inert = (smallScreen.matches && !state.menuOpen) || target === ui.artifactPanel;
    ui.mobileMenuButton.setAttribute("aria-expanded", String(state.menuOpen));
    for (const element of [ui.sidebar, ui.artifactPanel]) {
      if (element === target) { element.setAttribute("role", "dialog"); element.setAttribute("aria-modal", "true"); }
      else { element.removeAttribute("role"); element.removeAttribute("aria-modal"); }
    }
  }
  function closeMenu(restoreFocus = true) {
    const wasOpen = state.menuOpen;
    state.menuOpen = false;
    ui.sidebar.classList.remove("open");
    applyOverlayState();
    if (restoreFocus && wasOpen && smallScreen.matches) ui.mobileMenuButton.focus();
  }
  function openMenu() {
    closeArtifact(false);
    state.menuOpen = true;
    ui.sidebar.classList.add("open");
    applyOverlayState();
    ui.closeNavigation.focus();
  }
  function openArtifact() {
    if (state.current?.phase !== "ready") return;
    const active = document.activeElement;
    artifactReturnFocus = active instanceof HTMLElement && active !== document.body && !active.closest("[hidden]") ? active : ui.openArtifactButton;
    state.artifactOpen = true;
    state.menuOpen = false;
    ui.sidebar.classList.remove("open");
    ui.artifactPanel.hidden = false;
    applyOverlayState();
    navState();
    ui.closeArtifact.focus({ preventScroll: true });
  }
  function closeArtifact(restoreFocus = true) {
    const wasOpen = state.artifactOpen;
    state.artifactOpen = false;
    applyOverlayState();
    ui.artifactPanel.hidden = true;
    navState();
    if (wasOpen && restoreFocus) {
      const candidate = artifactReturnFocus;
      const target = candidate?.isConnected && candidate.getClientRects().length && !candidate.closest("[hidden], [inert]") && !candidate.disabled ? candidate : (ui.resultCard.hidden ? ui.composerInput : ui.openArtifactButton);
      target.focus({ preventScroll: true });
    }
  }
  function clearTimers() {
    state.sequence += 1;
    timers.forEach(clearTimeout);
    timers = [];
  }
  function chooseScenario(prompt) {
    const p = prompt.toLowerCase();
    if (/risk|launch|风险|发布/.test(p)) return "risks";
    if (/artifact|validat|prototype|验证|原型/.test(p)) return "artifact";
    return "brief";
  }
  function renderHistory() {
    const query = ui.conversationSearch.value.trim().toLocaleLowerCase();
    const records = [...state.sessions, ...examples];
    const results = records.filter((r) => `${r.title} ${r.prompt || scenarios[r.key].prompt}`.toLocaleLowerCase().includes(query));
    ui.historyList.replaceChildren();
    for (const record of results) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "history-item";
      button.dataset.historyId = record.id;
      if (state.current?.id === record.id) button.setAttribute("aria-current", "true");
      const title = document.createElement("span"); title.className = "history-item-title"; title.textContent = record.title;
      const meta = document.createElement("span"); meta.className = "history-item-meta"; meta.textContent = record.example ? "Example · local template" : "This session · ready";
      button.append(title, meta);
      button.addEventListener("click", () => {
        closeMenu(false);
        if (record.example) startTask(scenarios[record.key].prompt, record.key);
        else restoreSession(record);
      });
      ui.historyList.append(button);
    }
    ui.emptySearch.hidden = results.length !== 0;
    ui.clearSearch.hidden = query.length === 0;
    ui.searchStatus.textContent = query ? `${results.length} matching conversation${results.length === 1 ? "" : "s"}` : `${state.sessions.length} saved in this tab · ${examples.length} examples`;
  }
  function renderDocument(record) {
    const scenario = scenarios[record.key];
    ui.artifactTitle.textContent = scenario.title;
    ui.artifactHeading.textContent = scenario.heading;
    ui.artifactLede.textContent = scenario.lede;
    ui.resultTitle.textContent = scenario.title;
    ui.resultSummary.textContent = scenario.summary;
    ui.resultGrid.replaceChildren();
    ui.artifactSteps.replaceChildren();
    scenario.sections.forEach(([heading, body, short], i) => {
      const tile = document.createElement("div"); tile.className = "result-tile";
      const strong = document.createElement("strong"); strong.textContent = `${i + 1}. ${heading}`;
      const caption = document.createElement("span"); caption.textContent = short;
      tile.append(strong, caption); ui.resultGrid.append(tile);
      const section = document.createElement("section"); section.className = "artifact-step";
      const number = document.createElement("span"); number.className = "step-number"; number.setAttribute("aria-hidden", "true"); number.textContent = String(i + 1).padStart(2, "0");
      const copy = document.createElement("div");
      const h = document.createElement("h4"); h.textContent = heading;
      const p = document.createElement("p"); p.textContent = body;
      copy.append(h, p); section.append(number, copy); ui.artifactSteps.append(section);
    });
    modelLabels();
  }
  function startTask(prompt, key = chooseScenario(prompt)) {
    prompt = prompt.trim().slice(0, 16000);
    if (!prompt || !scenarios[key]) return;
    clearTimers();
    closeArtifact(false); closeMenu(false);
    state.attachmentSequence += 1;
    state.busy = true;
    state.current = { id: `session-${state.nextId++}`, title: prompt.length > 52 ? `${prompt.slice(0, 52)}…` : prompt, prompt, key, phase: "working", model: state.model };
    const sequence = state.sequence;
    ui.welcome.hidden = true; ui.thread.hidden = false; ui.resultCard.hidden = true; ui.retryButton.hidden = true;
    ui.userPrompt.textContent = prompt; ui.assistantIntro.textContent = scenarios[key].intro;
    ui.composerInput.value = ""; ui.inputError.hidden = true; ui.composerInput.removeAttribute("aria-invalid"); ui.attachmentStatus.hidden = true;
    modelLabels(); syncSend(); navState();
    status("1 of 2 · Organizing the local example…", "working");
    ui.conversationScroll.scrollTop = 0;
    ui.sendButton.focus({ preventScroll: true });
    const firstDelay = reducedMotion.matches ? 30 : 360;
    const finishDelay = reducedMotion.matches ? 80 : 900;
    timers.push(setTimeout(() => {
      if (sequence !== state.sequence) return;
      status("2 of 2 · Preparing your artifact…", "working");
    }, firstDelay));
    timers.push(setTimeout(() => {
      if (sequence !== state.sequence) return;
      state.busy = false; state.current.phase = "ready";
      renderDocument(state.current);
      state.sessions.unshift({ ...state.current }); state.sessions = state.sessions.slice(0, 25);
      ui.resultCard.hidden = false; syncSend(); navState(); renderHistory();
      status(`${scenarios[key].status} · local template`, "ready");
      openArtifact(); ui.artifactScroll.scrollTop = 0;
    }, finishDelay));
  }
  function stopTask() {
    clearTimers(); state.busy = false;
    if (state.current) state.current.phase = "stopped";
    ui.retryButton.hidden = false;
    status("Stopped. No artifact was generated. You can retry this task.", "stopped");
    syncSend(); navState();
    ui.retryButton.focus();
  }
  function restoreSession(record) {
    clearTimers(); state.busy = false;
    closeArtifact(false); closeMenu(false);
    state.current = { ...record }; state.model = record.model;
    ui.modelSelect.value = state.model;
    ui.welcome.hidden = true; ui.thread.hidden = false; ui.resultCard.hidden = false; ui.retryButton.hidden = true;
    ui.userPrompt.textContent = record.prompt;
    ui.assistantIntro.textContent = scenarios[record.key].intro;
    renderDocument(record); status(`${scenarios[record.key].status} · restored from this tab`, "ready");
    syncSend(); renderHistory(); navState(); openArtifact();
  }
  function newChat() {
    clearTimers(); state.attachmentSequence += 1; state.busy = false;
    closeArtifact(false); closeMenu(false); state.current = null;
    ui.welcome.hidden = false; ui.thread.hidden = true; ui.resultCard.hidden = true; ui.retryButton.hidden = true;
    ui.composerInput.value = ""; ui.conversationSearch.value = ""; ui.notesFile.value = "";
    ui.inputError.hidden = true; ui.attachmentStatus.hidden = true; ui.composerInput.removeAttribute("aria-invalid");
    syncSend(); navState(); renderHistory();
    ui.conversationScroll.scrollTop = 0; ui.composerInput.focus();
    say("New chat. Earlier examples remain in this tab’s conversation list.");
  }
  function submit() {
    if (state.busy) { stopTask(); return; }
    const prompt = ui.composerInput.value.trim();
    if (!prompt) {
      ui.inputError.textContent = "Write a prompt or choose a demo task first.";
      ui.inputError.hidden = false; ui.composerInput.setAttribute("aria-invalid", "true"); ui.composerInput.focus(); return;
    }
    startTask(prompt);
  }
  async function addNotes() {
    const file = ui.notesFile.files?.[0]; ui.notesFile.value = "";
    if (!file) return;
    const sequence = ++state.attachmentSequence;
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 1024 * 1024) {
      ui.inputError.textContent = "Choose a .txt or .md file no larger than 1 MB. Nothing was uploaded.";
      ui.inputError.hidden = false; return;
    }
    try {
      const text = await file.text();
      if (sequence !== state.attachmentSequence) return;
      const prefix = ui.composerInput.value ? `${ui.composerInput.value}\n\n` : "";
      const combined = `${prefix}${text}`;
      ui.composerInput.value = combined.slice(0, 16000);
      ui.attachmentStatus.textContent = `${file.name} added locally${combined.length > 16000 ? " (trimmed to 16,000 characters)" : ""}. Not uploaded.`;
      ui.attachmentStatus.hidden = false; ui.inputError.hidden = true; ui.composerInput.removeAttribute("aria-invalid");
      syncSend(); ui.composerInput.focus();
    } catch {
      ui.inputError.textContent = "This file could not be read. Paste your notes instead."; ui.inputError.hidden = false;
    }
  }
  function downloadArtifact() {
    if (state.current?.phase !== "ready") return;
    const s = scenarios[state.current.key];
    const text = `# ${s.heading}\n\n${s.lede}\n\n${s.sections.map(([h, p], i) => `## ${i + 1}. ${h}\n\n${p}`).join("\n\n")}\n\n---\nLocal template · ${state.model} (simulated)\nIndependent demo, not affiliated with Anthropic.\n\n## Your prompt\n\n${state.current.prompt}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${state.current.key}-artifact.md`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("Artifact downloaded as a Markdown file. No data was sent to a server.");
  }
  document.querySelectorAll("[data-scenario]").forEach((b) => b.addEventListener("click", () => startTask(scenarios[b.dataset.scenario].prompt, b.dataset.scenario)));
  ui.composerForm.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  ui.composerInput.addEventListener("input", () => { ui.inputError.hidden = true; ui.composerInput.removeAttribute("aria-invalid"); syncSend(); });
  ui.composerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); if (!state.busy) submit(); }
  });
  ui.modelSelect.addEventListener("change", () => { state.model = ui.modelSelect.value; modelLabels(); say(`${state.model} selected for this local preview. No model API is called.`); });
  ui.conversationSearch.addEventListener("input", renderHistory);
  ui.clearSearch.addEventListener("click", () => { ui.conversationSearch.value = ""; renderHistory(); ui.conversationSearch.focus(); });
  ui.newChatBtn.addEventListener("click", newChat);
  ui.mobileMenuButton.addEventListener("click", openMenu);
  ui.closeNavigation.addEventListener("click", () => closeMenu());
  ui.closeArtifact.addEventListener("click", () => closeArtifact());
  ui.openArtifactButton.addEventListener("click", openArtifact);
  ui.artifactsNav.addEventListener("click", openArtifact);
  ui.chatsNav.addEventListener("click", () => { closeArtifact(false); closeMenu(false); ui.composerInput.focus(); });
  ui.scrim.addEventListener("click", () => { if (state.artifactOpen) closeArtifact(); else closeMenu(); });
  ui.retryButton.addEventListener("click", () => { if (state.current) startTask(state.current.prompt, state.current.key); });
  ui.attachButton.addEventListener("click", () => ui.notesFile.click());
  ui.notesFile.addEventListener("change", addNotes);
  ui.downloadArtifact.addEventListener("click", downloadArtifact);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.artifactOpen) { event.preventDefault(); closeArtifact(); }
      else if (state.menuOpen) { event.preventDefault(); closeMenu(); }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); newChat(); return; }
    const modal = modalTarget();
    if (event.key !== "Tab" || !modal) return;
    const targets = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select, a[href], summary, [tabindex="0"]')).filter((el) => el.getClientRects().length && !el.closest("[inert], [hidden]"));
    const first = targets[0], last = targets[targets.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  function breakpointChanged() {
    if (!smallScreen.matches && state.menuOpen) { state.menuOpen = false; ui.sidebar.classList.remove("open"); ui.newChatBtn.focus(); }
    applyOverlayState();
    if (state.artifactOpen && overlayScreen.matches && !ui.artifactPanel.contains(document.activeElement)) ui.closeArtifact.focus();
    else if (smallScreen.matches && !state.menuOpen && !state.artifactOpen && ui.sidebar.contains(document.activeElement)) ui.mobileMenuButton.focus();
  }
  smallScreen.addEventListener("change", breakpointChanged);
  overlayScreen.addEventListener("change", breakpointChanged);
  modelLabels(); syncSend(); navState(); renderHistory(); applyOverlayState();
})();
