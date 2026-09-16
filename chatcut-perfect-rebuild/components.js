import { ASSETS } from "./assets.js";

const img = (src, alt="", cls="") => `<img class="${cls}" src="${src}" alt="${alt}">`;

export function AnnouncementBar() {
  return `<div class="announcement"><div class="shell">
    <span>Seedance 2.5 is live</span>
    <b>Limited-time offer: up to 51% off, from just $0.046/sec</b>
    <a href="#pricing">Upgrade Now →</a>
  </div></div>`;
}

export function SiteHeader() {
  return `<nav class="site-nav"><div class="shell nav-inner">
    <a class="brand" href="#top">ChatCut</a>
    <div class="nav-links">
      <button type="button">Features</button>
      <button type="button">Resources</button>
      <button type="button">Plugin</button>
      <button type="button">Desktop</button>
      <a href="#pricing">Pricing</a>
    </div>
    <div class="nav-actions"><button class="ghost">EN</button><a class="dark-btn" href="#expert">Try Now</a></div>
  </div></nav>`;
}

export function HeroSection() {
  return `<header class="hero" id="top"><div class="shell">
    <div class="eyebrow">YOUR AI VIDEO EDITOR</div>
    <h1>Edit videos by telling AI what you want</h1>
    <p>Tell it everything you want, every thought you have. And ChatCut turns it all into a video.</p>
    <div class="hero-actions">
      <a class="dark-btn hero-btn" href="#editor-demo">Enter ChatCut Editor</a>
      <button class="light-btn hero-btn" id="agentToggle" type="button">Use it in your Agent</button>
    </div>
    <div class="agent-box" id="agentBox">
      <div class="agent-tabs">
        <button class="agent-tab active" data-agent="chatgpt" type="button">
          ${img(ASSETS.chatgptMark, "", "agent-mark")} ChatGPT
        </button>
        <button class="agent-tab" data-agent="claude" type="button">
          ${img(ASSETS.claudeMark, "", "agent-mark")} Claude
        </button>
      </div>
      <div class="agent-command" id="agentCommand">/goal Read chatcut.io/chatgpt to install the ChatCut plugin and set up a new task for me.</div>
    </div>
  </div></header>`;
}

export function EditorDemoSection() {
  return `<section class="section alt" id="editor-demo"><div class="shell">
    <div class="section-heading center">
      <h2>How do you edit a good video?</h2>
    </div>
    <div class="editor-demo">
      <div class="editor-copy">
        <h3>Please edit this video for me, give it a retro feel, and add music with suitable camera movement.</h3>
        <p><b>how-to-edit.mp4</b> · Original footage — 12:37</p>
        <div class="steps">
          <span>● Review speech · choose the opening line</span>
          <span>● Edit footage · arrange the talking-head cut</span>
          <span>● Add camera movement · zoom in and out</span>
          <span>● Style and soundtrack · retro titles and music</span>
        </div>
      </div>
      <div class="editor-video">
        ${img(ASSETS.editorPoster, "ChatCut editor preview")}
        <button class="export-btn" type="button">Export</button>
        <div class="video-controls">▶ 00:00 / 00:19.27 · captions · speed · audio tracks</div>
      </div>
    </div>
  </div></section>`;
}

export function ExpertEditorSection() {
  const frames = [...ASSETS.bestMoments.middle, ...ASSETS.bestMoments.high, ...ASSETS.bestMoments.down];
  return `<section class="section" id="expert"><div class="shell expert-layout">
    <div class="section-copy">
      <div class="overline">BEST MOMENTS</div>
      <h2>Edit Like an Expert Editor</h2>
      <p>Find the best moments and build your first cut.</p>
      <div class="prompt-row">
        <input id="expertPrompt" value="Find the highlights and add B-roll to my video." aria-label="Expert Editor prompt">
        <button class="send-btn" id="expertSend" type="button">→</button>
      </div>
      <div class="status" id="expertStatus">Paused · waiting for Send</div>
    </div>
    <div class="expert-media">
      <div class="stage">
        ${img(ASSETS.bestMoments.middle[1], "Best moment preview", "stage-image")}
        <span class="stage-badge" id="expertBadge">Paused</span>
      </div>
      <div class="filmstrip">
        ${frames.map(u => img(u)).join("")}
        <span class="playhead" id="expertPlayhead"></span>
      </div>
    </div>
  </div></section>`;
}

export function MotionGraphicsSection() {
  return `<section class="section alt" id="motion"><div class="shell">
    <div class="section-heading">
      <div><div class="overline">MOTION GRAPHICS</div>
      <h2>AI Motion Graphics,<br>Generated From a Sentence</h2>
      <p>Create editable animations with a prompt.</p></div>
    </div>
    <div class="tabs">
      <button class="tab active" type="button">Editorial set</button>
      <button class="tab" type="button">MindSpace</button>
      <button class="tab" type="button">Data overlays</button>
    </div>
    <div class="prompt-row wide">
      <input value="Turn this rough creator edit into crisp chapters, charts, and emphasized on-screen moments." aria-label="Motion graphics prompt">
      <button class="send-btn" id="motionSend" type="button">→</button>
    </div>
    <div class="motion-grid">
      <article class="motion-card cover"><span>Chapter page number icon animation</span></article>
      <article class="motion-card" id="motionTarget"><div class="chart"><i></i><i></i><i></i><i></i></div><span>Bar chart growth animation</span></article>
      <article class="motion-card"><span>Vertical timeline animation</span></article>
      <article class="motion-card"><span>Pie chart animation</span></article>
      <article class="motion-card"><span>Keyword typing animation</span></article>
      <article class="motion-card"><span>Type emphasis animation</span></article>
    </div>
    <div class="status" id="motionStatus">Send the prompt to generate the graphic in place.</div>
  </div></section>`;
}

export function TranscriptCaptionsSection() {
  return `<section class="section" id="transcript"><div class="shell">
    <div class="section-heading"><div>
      <div class="overline">TRANSCRIPT & CAPTIONS</div>
      <h2>Text-based editing + captions</h2>
    </div></div>
    <div class="two-col">
      <article class="feature-panel">
        <div class="panel-top">Transcript <span>my-first-video.mp4</span></div>
        <h3>Text-Based Editing for Your Talking Head Content</h3>
        <p>Edit your video by editing the transcript.</p>
        <div class="transcript-text" id="transcriptText">
          So <span class="filler">um</span> today I want to talk about <span class="filler">uh</span> how to actually make your videos look <span class="filler">you know</span> really professional.
          <span class="filler">Um</span> the first thing is like you gotta have good lighting.
          <span class="filler">Uh</span> and then <span class="filler">you know</span> the editing part is where the magic happens.
        </div>
        <div class="prompt-row">
          <input value="Clean up all the filler words" aria-label="Text editing prompt">
          <button class="send-btn" id="textEditSend" type="button">→</button>
        </div>
        <div class="timeline"><span class="clip"></span><span class="clip" id="clip1"></span><span class="clip"></span><span class="clip" id="clip2"></span></div>
        <div class="status" id="textStatus">Raw transcript · filler words still in video</div>
      </article>
      <article class="feature-panel">
        <div class="panel-top">Captions <span>100+ languages</span></div>
        <h3>Auto AI Captions, in 100+ Languages</h3>
        <p>Add and style captions in 100+ languages.</p>
        <div class="caption-preview">
          ${img(ASSETS.captionsHero, "Auto AI captions preview")}
          <span class="caption-text" id="captionText">This one is good.</span>
        </div>
        <div class="caption-nav">
          <button id="captionPrev" type="button">‹</button>
          <span id="captionStyle">Plain</span>
          <button id="captionNext" type="button">›</button>
        </div>
      </article>
    </div>
  </div></section>`;
}

export function ImageGenerationSection() {
  return `<section class="section alt" id="image-gen"><div class="shell">
    <div class="section-heading"><div><div class="overline">IMAGE GENERATION</div>
      <h2>AI Image Generation,<br>Right Inside Your Edit</h2>
      <p>Generate images and add them to your edit.</p></div>
    </div>
    <div class="gen-layout">
      <div class="gen-media" id="imageMedia">
        ${img(ASSETS.imageBefore, "Source image before AI generation", "source")}
        ${img(ASSETS.imageAfter, "Generated image after AI generation", "result")}
        <div class="loading" id="imageLoading">Generating image…</div>
      </div>
      <div class="gen-controls">
        <div class="scene-tabs">
          ${["Creator portrait","Image to video","Desktop setup","Music timeline","Script board","Tutorial setup"].map((t,i)=>`<button class="${i===0?"active":""}" type="button">${t}</button>`).join("")}
        </div>
        <div class="prompt-row">
          <textarea aria-label="Image generation prompt">Generate a cinematic creator portrait for a video editing story.</textarea>
          <button class="send-btn" id="imageSend" type="button">→</button>
        </div>
        <div class="status" id="imageStatus">Boring source first · result hidden until Generate</div>
      </div>
    </div>
  </div></section>`;
}

export function VideoGenerationSection() {
  return `<section class="section" id="video-gen"><div class="shell">
    <div class="section-heading"><div><div class="overline">VIDEO GENERATION</div>
      <h2>AI Video Generation for the<br>Shots You Couldn't Film</h2>
      <p>Generate the shots your video needs.</p></div>
    </div>
    <div class="gen-layout">
      <div class="gen-media video-gen" id="videoMedia">
        ${img(ASSETS.videoFirst, "Reference image", "source")}
        ${img(ASSETS.videoLast, "Generated video end frame", "result")}
        <div class="loading" id="videoLoading">Generating video…</div>
      </div>
      <div class="gen-controls">
        <div class="ref-row">
          <div class="ref-thumb">${img(ASSETS.videoFirst, "Selected reference")}</div>
          <div class="ref-label">Reference image selected</div>
        </div>
        <div class="scene-tabs">
          ${["Comic to Live-Action Film","Glitch Logo Animation","Cinematic Logo Animation","Times Square","Liquid Logo"].map((t,i)=>`<button class="${i===0?"active":""}" type="button">${t}</button>`).join("")}
        </div>
        <div class="prompt-row">
          <textarea aria-label="Video generation prompt">Turn a comic reference into a short live-action cinematic sequence.</textarea>
          <button class="send-btn" id="videoSend" type="button">→</button>
        </div>
        <div class="status" id="videoStatus">Reference image ready · video not generated yet</div>
      </div>
    </div>
  </div></section>`;
}

export function MusicSection() {
  const bars = Array.from({length:18},()=>"<i></i>").join("");
  return `<section class="section alt" id="music"><div class="shell">
    <div class="section-heading"><div><div class="overline">MUSIC</div>
      <h2>AI Music Generator for Video,<br>Royalty Free</h2>
      <p>Create royalty-free music for your video.</p></div>
    </div>
    <div class="music-layout">
      <div class="music-player" id="musicPlayer">
        <div class="music-poster">
          ${img(ASSETS.musicRaw, "Silent source video", "music-image")}
          <span class="audio-tag silent">🔇 silent video</span>
          <span class="audio-tag music">♪ royalty-free music added</span>
        </div>
        <div class="wave" id="musicWave">${bars}</div>
        <div class="genres">${["Electronic","Lo-fi","Cinematic","Jazz","Ambient"].map((g,i)=>`<span class="${i===0?"active":""}">${g}</span>`).join("")}</div>
      </div>
      <div class="music-copy">
        <h3>AI Music shaped to your edit.</h3>
        <p>Describe the vibe and the length — ChatCut generates a royalty-free track right onto your timeline.</p>
        <div class="prompt-row">
          <input value="Add warm, upbeat royalty-free music under this video." aria-label="AI music prompt">
          <button class="send-btn" id="musicSend" type="button">→</button>
        </div>
        <div class="status" id="musicStatus">Silent video · no music track yet</div>
      </div>
    </div>
  </div></section>`;
}

export function PricingSection() {
  const plans = [
    ["100 credits/month","$25"],
    ["200 credits/month","$45"],
    ["400 credits/month","$88"],
    ["800 credits/month","$160"],
  ];
  return `<section class="section" id="pricing"><div class="shell">
    <div class="section-heading center"><div><div class="overline">PRICING</div><h2>Pricing</h2></div></div>
    <div class="billing"><div class="billing-inner"><button class="active" data-billing="monthly" type="button">Monthly</button><button data-billing="annual" type="button">Annual</button></div></div>
    <div class="price-grid">
      ${plans.map((p,i)=>`<article class="price-card"><small>Plus · ${p[0]}</small><div class="price" id="price${i+1}">${p[1]}</div><ul><li>AI video generation</li><li>AI image generation</li><li>Motion graphics</li><li>AI music</li></ul><button type="button">Get started</button></article>`).join("")}
    </div>
  </div></section>`;
}

export function FAQSection() {
  const qs = [
    ["What is ChatCut?","A web-based AI video editor where you describe the edit you want."],
    ["How does conversational editing work?","Describe the outcome and ChatCut updates the project."],
    ["Who is ChatCut for?","Creators, marketers, teams, and people who want less manual editing."],
    ["Can I still edit manually?","Yes. AI-generated changes remain editable."],
  ];
  return `<section class="section alt"><div class="shell"><div class="section-heading center"><div><div class="overline">QUESTIONS</div><h2>Questions</h2></div></div><div class="faq">${qs.map(q=>`<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join("")}</div></div></section>`;
}

export function Footer() {
  return `<footer class="footer"><div class="shell footer-grid">
    <div><a class="brand footer-brand" href="#top">ChatCut</a><p>Tell ChatCut what you want to make…</p><div class="footer-input"><input placeholder="Describe your video"><button type="button">→</button></div></div>
    <div><h4>Company</h4><a href="#">Careers</a><a href="#">Contact</a></div>
    <div><h4>Product</h4><a href="#expert">AI Video Editor</a><a href="#motion">AI Motion Graphics</a><a href="#video-gen">AI Video Generator</a><a href="#transcript">AI Captions</a><a href="#music">AI Music Generator</a></div>
    <div><h4>Resources</h4><a href="#">Blog</a><a href="#">Prompt Library</a><a href="#">Discord</a></div>
    <div><h4>Plugins</h4><a href="#">ChatGPT / Codex</a><a href="#">Claude Code</a><a href="#">Desktop</a></div>
  </div></footer>`;
}

export function AppMarkup() {
  return [
    AnnouncementBar(),
    SiteHeader(),
    HeroSection(),
    EditorDemoSection(),
    ExpertEditorSection(),
    MotionGraphicsSection(),
    TranscriptCaptionsSection(),
    ImageGenerationSection(),
    VideoGenerationSection(),
    MusicSection(),
    PricingSection(),
    FAQSection(),
    Footer(),
  ].join("");
}
