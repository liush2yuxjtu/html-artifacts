# ChatCut Perfect Rebuild — design.md

## Intent
Rebuild the current public ChatCut homepage as editable components, while preserving the live site's visible hierarchy and public media references. Then add only minimal Cursor-style interactions where the product story benefits from “one action → result happens in place”.

## Provenance
- Component code: clean-room reimplementation in this directory.
- Copy/hierarchy: derived from the current public ChatCut homepage and public feature pages audited on 2026-09-16.
- Media: referenced by URL from `chatcut.io`; files are **not copied or redistributed** in this repo.
- Proprietary site source/CSS/JS: not copied.

## Component hierarchy
### Global
- AnnouncementBar
- SiteHeader
- HeroSection
- Footer

### Product demos
- EditorDemoSection
- ExpertEditorSection
- MotionGraphicsSection
- TranscriptCaptionsSection
- ImageGenerationSection
- VideoGenerationSection
- MusicSection
- PricingSection
- FAQSection

### Atomic patterns
- Button
- PromptRow
- TabGroup
- StatusLine
- Filmstrip
- Playhead
- FeaturePanel
- GenerationMedia
- SceneTabs
- BillingToggle

## Interaction contract
1. Expert Editor: paused frame → Send → same filmstrip continues.
2. Motion Graphics: prompt → one existing result card becomes generated/selected.
3. Transcript: “Clean up filler words” → filler text is struck through and timeline shrinks.
4. Captions: keep existing carousel behavior.
5. Image: source image first → Generate → result appears.
6. Video: reference image first → Generate → loading → generated shot.
7. Music: silent source first → Send → waveform and royalty-free music state.
8. Pricing: current 4-card structure, local Monthly/Annual toggle.

## Design rules
- Keep white/off-white canvas and dark brown/black typography.
- Max content width ≈ 1180–1200px.
- Major section vertical rhythm ≈ 72–96px.
- Card radii ≈ 12–18px; small controls ≈ 8–10px.
- Avoid introducing a second “editor app” UI where the current homepage does not have one.
- Each section should have at most one new primary interaction.
