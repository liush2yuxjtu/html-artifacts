import { AppMarkup } from "./components.js";
import { ASSETS } from "./assets.js";

document.getElementById("app").innerHTML = AppMarkup();

const $$ = (sel) => [...document.querySelectorAll(sel)];
const $ = (sel) => document.querySelector(sel);

const commands = {
  chatgpt: "/goal Read chatcut.io/chatgpt to install the ChatCut plugin and set up a new task for me.",
  claude: "/goal Read chatcut.io/claude to install and use the ChatCut plugin",
};
$("#agentToggle").addEventListener("click", () => $("#agentBox").scrollIntoView({behavior:"smooth", block:"center"}));
$$(".agent-tab").forEach(btn => btn.addEventListener("click", () => {
  $$(".agent-tab").forEach(x => x.classList.toggle("active", x === btn));
  $("#agentCommand").textContent = commands[btn.dataset.agent];
}));

const expertFrames = [...ASSETS.bestMoments.middle, ...ASSETS.bestMoments.high, ...ASSETS.bestMoments.down];
let expertTimer = null;
$("#expertSend").addEventListener("click", () => {
  if (expertTimer) clearInterval(expertTimer);
  let i = 0;
  $("#expertStatus").textContent = "Playing · finding highlights + adding B-roll";
  $("#expertBadge").textContent = "Playing";
  expertTimer = setInterval(() => {
    i += 1;
    $(".stage-image").src = expertFrames[i % expertFrames.length];
    $("#expertPlayhead").style.left = `${18 + Math.min(i,6) * 11}%`;
    if (i >= 6) {
      clearInterval(expertTimer);
      expertTimer = null;
      $("#expertStatus").textContent = "Done · first cut updated";
      $("#expertBadge").textContent = "Done";
    }
  }, 240);
});

$("#motionSend").addEventListener("click", () => {
  $("#motionTarget").classList.toggle("generated");
  $("#motionStatus").textContent = $("#motionTarget").classList.contains("generated")
    ? "Generated · Bar chart growth animation"
    : "Send the prompt to generate the graphic in place.";
});
$$("#motion .tab").forEach(tab => tab.addEventListener("click", () => {
  $$("#motion .tab").forEach(x => x.classList.toggle("active", x === tab));
}));

$("#textEditSend").addEventListener("click", () => {
  $$("#transcriptText .filler").forEach(x => x.classList.add("removed"));
  $("#clip1").classList.add("cut");
  $("#clip2").classList.add("cut");
  $("#textStatus").textContent = "6 filler phrases removed · timeline shortened";
});

const styles = ["Plain","TikTok","Pop","Submagic","French Dispatch","Bubble","Noir","Glass","Dogme","Signal","Flux"];
let captionIndex = 0;
function renderCaption() {
  $("#captionStyle").textContent = styles[captionIndex];
  $("#captionText").textContent = styles[captionIndex] === "TikTok" ? "THIS ONE IS GOOD." : "This one is good.";
  $("#captionText").style.textTransform = styles[captionIndex] === "Pop" ? "uppercase" : "none";
}
$("#captionPrev").addEventListener("click", () => { captionIndex = (captionIndex - 1 + styles.length) % styles.length; renderCaption(); });
$("#captionNext").addEventListener("click", () => { captionIndex = (captionIndex + 1) % styles.length; renderCaption(); });

$$(".scene-tabs").forEach(group => {
  [...group.querySelectorAll("button")].forEach(btn => btn.addEventListener("click", () => {
    [...group.querySelectorAll("button")].forEach(x => x.classList.toggle("active", x === btn));
  }));
});

let imageTimer = null;
$("#imageSend").addEventListener("click", () => {
  $("#imageMedia").classList.remove("done");
  $("#imageLoading").classList.add("on");
  $("#imageStatus").textContent = "Generating…";
  clearTimeout(imageTimer);
  imageTimer = setTimeout(() => {
    $("#imageLoading").classList.remove("on");
    $("#imageMedia").classList.add("done");
    $("#imageStatus").textContent = "Generated · image ready to add to edit";
  }, 800);
});

let videoTimer = null;
$("#videoSend").addEventListener("click", () => {
  $("#videoMedia").classList.remove("done","playing");
  $("#videoLoading").classList.add("on");
  $("#videoStatus").textContent = "Generating video from reference…";
  clearTimeout(videoTimer);
  videoTimer = setTimeout(() => {
    $("#videoLoading").classList.remove("on");
    $("#videoMedia").classList.add("done","playing");
    $("#videoStatus").textContent = "Video loaded · playing generated shot";
  }, 900);
});

$("#musicSend").addEventListener("click", () => {
  $("#musicPlayer").classList.add("on");
  $("#musicWave").classList.add("on");
  $(".music-image").src = ASSETS.musicPoster;
  $("#musicStatus").textContent = "Royalty-free music generated · track added";
});

const monthly = ["$25","$45","$88","$160"];
const annual = ["$20","$40","$78","$128"];
$$("[data-billing]").forEach(btn => btn.addEventListener("click", () => {
  $$("[data-billing]").forEach(x => x.classList.toggle("active", x === btn));
  const list = btn.dataset.billing === "annual" ? annual : monthly;
  list.forEach((v,i) => $(`#price${i+1}`).textContent = v);
}));

window.addEventListener("pagehide", () => {
  if (expertTimer) clearInterval(expertTimer);
  if (imageTimer) clearTimeout(imageTimer);
  if (videoTimer) clearTimeout(videoTimer);
}, {once:true});
