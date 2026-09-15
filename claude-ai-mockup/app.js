const state = {
  model: "Sonnet 5",
  prompt: "",
  artifactOpen: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const welcome = $("#welcome");
const thread = $("#thread");
const userPrompt = $("#userPrompt");
const assistantIntro = $("#assistantIntro");
const statusText = $("#statusText");
const modelLabel = $("#modelLabel");
const artifactModel = $("#artifactModel");
const artifactPanel = $("#artifactPanel");
const artifactTitle = $("#artifactTitle");
const artifactHeading = $("#artifactHeading");
const artifactLede = $("#artifactLede");
const composerInput = $("#composerInput");
const modelSelect = $("#modelSelect");
const toast = $("#toast");
const sidebar = $("#sidebar");
const mobileScrim = $("#mobileScrim");

const scenarios = {
  brief: {
    prompt: "Create a one-page product brief for an AI teammate that turns messy notes into clear next steps.",
    intro: "I’ll turn the idea into a small product story with an explicit job, visible proof, and a verification loop. The artifact keeps the claim testable instead of burying it in feature language.",
    status: "Product brief ready",
    title: "Product brief",
    heading: "A product story people can judge",
    lede: "A compact brief for an AI teammate that converts messy inputs into clear, verifiable next steps.",
  },
  risks: {
    prompt: "Analyze this fictional launch plan and list the three biggest risks with mitigations.",
    intro: "The plan is most fragile where confidence is high but evidence is thin. I’ve organized the result around assumptions, observable risk signals, and the cheapest mitigation that creates new evidence.",
    status: "Risk review ready",
    title: "Launch risk review",
    heading: "Reduce uncertainty before adding scope",
    lede: "Three launch risks framed as testable assumptions, with mitigations designed to produce evidence quickly.",
  },
  artifact: {
    prompt: "Build a simple artifact that explains how a team can move from idea to validated product demo.",
    intro: "I mapped the workflow into four stages so the team can see where an idea becomes evidence. The artifact emphasizes behavior and proof rather than polish for its own sake.",
    status: "Artifact ready",
    title: "Validation workflow",
    heading: "From idea to evidence",
    lede: "A four-step product-demo loop that turns a claim into something a user can try, judge, and reject or accept.",
  },
};

function scenarioForPrompt(prompt) {
  const lowered = prompt.toLowerCase();
  if (lowered.includes("risk") || lowered.includes("launch")) return scenarios.risks;
  if (lowered.includes("artifact") || lowered.includes("validated") || lowered.includes("prototype")) return scenarios.artifact;
  return scenarios.brief;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
}

function updateModel() {
  state.model = modelSelect.value;
  modelLabel.textContent = `Working with ${state.model}`;
  artifactModel.textContent = state.model;
  if (thread.classList.contains("active")) showToast(`${state.model} selected`);
}

function renderScenario(prompt) {
  const scenario = scenarioForPrompt(prompt);
  state.prompt = prompt;
  userPrompt.textContent = prompt;
  assistantIntro.textContent = scenario.intro;
  statusText.textContent = scenario.status;
  artifactTitle.textContent = scenario.title;
  artifactHeading.textContent = scenario.heading;
  artifactLede.textContent = scenario.lede;
  modelLabel.textContent = `Working with ${state.model}`;
  artifactModel.textContent = state.model;
  welcome.hidden = true;
  thread.classList.add("active");
  composerInput.value = "";
  showToast(scenario.status);
}

function openArtifact() {
  state.artifactOpen = true;
  artifactPanel.classList.add("open");
  artifactPanel.setAttribute("aria-hidden", "false");
  $("#closeArtifact").focus({ preventScroll: true });
}

function closeArtifact() {
  state.artifactOpen = false;
  artifactPanel.classList.remove("open");
  artifactPanel.setAttribute("aria-hidden", "true");
}

function newChat() {
  state.prompt = "";
  welcome.hidden = false;
  thread.classList.remove("active");
  composerInput.value = "";
  closeArtifact();
  closeMobileMenu();
  composerInput.focus();
  showToast("New local chat");
}

function openMobileMenu() {
  sidebar.classList.add("open");
  mobileScrim.classList.add("show");
}

function closeMobileMenu() {
  sidebar.classList.remove("open");
  mobileScrim.classList.remove("show");
}

function submitComposer() {
  const prompt = composerInput.value.trim();
  if (!prompt) {
    showToast("Type a prompt first");
    composerInput.focus();
    return;
  }
  renderScenario(prompt);
}

$$('[data-scenario]').forEach((button) => {
  button.addEventListener("click", () => renderScenario(scenarios[button.dataset.scenario].prompt));
});

$$('[data-prompt]').forEach((button) => {
  button.addEventListener("click", () => {
    renderScenario(button.dataset.prompt);
    closeMobileMenu();
  });
});

$$('[data-nav]').forEach((button) => {
  button.addEventListener("click", () => {
    $$('.nav-item').forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    if (button.dataset.nav === "artifacts") openArtifact();
    else showToast(`${button.textContent.trim()} is simulated in this demo`);
    closeMobileMenu();
  });
});

modelSelect.addEventListener("change", updateModel);
$("#newChatBtn").addEventListener("click", newChat);
$("#sendButton").addEventListener("click", submitComposer);
$("#openArtifactButton").addEventListener("click", openArtifact);
$("#closeArtifact").addEventListener("click", closeArtifact);
$("#mobileMenuButton").addEventListener("click", openMobileMenu);
mobileScrim.addEventListener("click", closeMobileMenu);

composerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitComposer();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.artifactOpen) closeArtifact();
    else closeMobileMenu();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    newChat();
  }
});

updateModel();
