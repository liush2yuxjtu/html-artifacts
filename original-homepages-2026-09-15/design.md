# design.md — original homepage systems

> Snapshot date: 2026-09-15  
> Sources: `https://chatcut.io/`, `https://cursor.com/`  
> Rule: this document describes the originals. Do not "improve", merge, normalize, or restyle one brand to look like the other.

## 0. Reproduction contract

1. Preserve each site's original visual personality, page rhythm, content density, hierarchy, and product-demo framing.
2. Prefer the observed desktop geometry below over generic framework defaults.
3. Product mock interfaces are part of the marketing design system, not decorative screenshots: selected rows, tabs, state labels, playheads, and task panels should visibly respond to click.
4. Do not reuse Cursor's warm-gray visual system inside ChatCut or ChatCut's rounded black CTA language inside Cursor unless the source actually does so.
5. Values marked **observed** came from the rendered page / DOM inspection. Values marked **estimated** were reconstructed from screenshots at approximately 1280px desktop width.

---

# 1. ChatCut

## 1.1 Brand character

Light, warm-white AI creative-tool landing page. High contrast black type, restrained warm borders, generous whitespace, and large product-editor mocks. The visual emphasis is the video canvas/timeline rather than abstract illustration.

## 1.2 Core tokens

| Token | Value | Confidence |
|---|---:|---|
| `--cc-bg` | `#FCFBF9` | observed/estimated |
| `--cc-surface` | `#FFFFFF` | observed |
| `--cc-editor-secondary` | `#F5F5F5` | observed |
| `--cc-text` | `#09090B` | observed |
| `--cc-muted` | `#71717A` | observed |
| `--cc-border` | `#E5E0D8` | observed |
| `--cc-hover` | `#F0F0F0` | observed |
| `--cc-nav-h` | `70px` | observed |
| `--cc-radius-card` | `8px` | observed/estimated |
| `--cc-radius-cta` | `12px` | observed |
| `--cc-section-gap` | `64px–96px` | observed/estimated |

### Typography

- Primary family: modern UI sans; use `Inter, ui-sans-serif, system-ui` in the static reproduction.
- Hero H1: **64–70px**, bold, line-height about **1.10**, tight tracking.
- Section H2: 42–52px desktop, bold, line-height 1.08–1.15.
- Body: **18px / 28px**, regular 400.
- Small UI labels: 12–14px.
- Buttons: about **15px**, semibold.

### Layout

- Desktop content max: approximately **1180–1200px**.
- Hero content is centered and visually compact above a large editor demo.
- Major sections use 64–96px vertical gutters, increasing around the hero/editor transition.
- Editor mock: approximately **960 × 540px** in the inspected viewport.
- Editor sidebar: approximately **300px**.
- Main feature card sample: approximately **235 × 70px**, 1px warm border, 8px radius.

## 1.3 Component inventory

### Navbar

- 70px height.
- White surface, 1px warm bottom border.
- Left: brand.
- Center/left: Features, Resources, Plugin, Desktop, Pricing.
- Right: language + strong Try Now CTA.
- Dropdowns are light floating panels with compact icon/title/description rows.

### Hero

Hierarchy:

1. eyebrow: `YOUR AI VIDEO EDITOR`
2. large H1: `Edit videos by telling AI what you want`
3. primary black CTA to editor
4. secondary agent entry
5. ChatGPT / Claude switching region
6. large interactive editing mock

Primary CTA measured around **180 × 40px**, black surface, 12px radius.

### Product editor mock

Marketing demo geometry:

- pale application shell
- left agent/chat rail
- central video preview
- lower timeline with stacked video/audio tracks
- small toolbar / export action
- selection and timeline positions visibly change with demo state

### Section pattern

Most feature sections follow one of these patterns:

- centered H2 + one-line supporting text + large demo
- two-column explanatory copy + product UI
- tab bar + six compact feature cards
- pricing grid of four cards
- FAQ accordion rows

### Interactions

- nav dropdown selected/hover: subtle warm-gray fill or text shift
- white secondary button hover: `#F0F0F0`
- Motion Graphics selected tab: black background, white text; inactive tabs muted gray
- pricing toggle: dark active segment / muted inactive segment
- editor demo: visible selection state, timeline state, preview state

## 1.4 Section order

1. announcement banner
2. navbar
3. hero + agent selector + editor mock
4. best moments / expert editor
5. AI motion graphics
6. transcript editing
7. captions
8. image generation
9. video generation
10. music generation
11. pricing
12. questions / FAQ
13. footer

---

# 2. Cursor

## 2.1 Brand character

Warm off-white product/research site. Extremely restrained component styling, square-to-soft radii, minimal shadows, dark charcoal text, and large realistic software mocks. The visual system feels editorial and utilitarian rather than SaaS-decorative.

## 2.2 Core tokens

| Token | Value | Confidence |
|---|---:|---|
| `--cu-bg` | `#F5F5F0` | observed/estimated |
| `--cu-surface` | `#FFFFFF` | observed |
| `--cu-text` | `#141414` | observed |
| `--cu-editor-text` | `#26251E` | observed |
| `--cu-muted` | `#757575` | observed |
| `--cu-border` | `#E0E0E0` | observed |
| `--cu-accent-plan` | `#C08532` | observed |
| `--cu-radius-button` | `5px` | estimated from rendered page |
| `--cu-radius-card` | `5–8px` | estimated |
| `--cu-section-gap` | `80–160px` | observed/estimated |

### Typography

- Primary family: neutral grotesk UI sans; static reproduction uses `Arial, Helvetica, ui-sans-serif, system-ui` with tight tracking.
- Hero: **56–72px**, bold, line-height roughly 1.1.
- Section H2: **32–48px**.
- Body: **16–17px**, line-height 1.5–1.7.
- Nav / buttons / footer: about **14px**.
- Product mock task labels: about **12px**.
- Product mock code/terminal: monospace, 12–16px.

### Layout

- Navbar observed around **60–70px**.
- Large horizontal page gutters, restrained max-width.
- Major sections separated by 80–160px.
- Product mocks use broad rectangular app windows with thin borders and almost no heavy shadow.
- Standard CTA padding about 8px 16px; hero CTA slightly larger.

## 2.3 Component inventory

### Navbar

- white/off-white surface
- Cursor wordmark left
- Models, Product, Enterprise, Pricing, Resources
- right actions: Sign in, Contact sales, Download
- compact 5px-radius buttons
- dropdown nav with minimal decoration

### Hero

Hierarchy:

1. huge left-aligned headline: `Cursor is your coding agent for building ambitious software.`
2. platform download / get-started / demo actions
3. giant interactive multi-surface product demo

The hero is deliberately spare; the product mock carries the visual weight.

### Interactive product mocks

#### Desktop / agent list

- left task rail approximately 220px
- task rows approximately 52px tall
- headings such as In Progress / Ready for Review
- right content/editor panel
- small timestamps and diff statistics
- selected task changes right-side content

#### IDE mock

- file tabs around 31px high
- active tab underline or selected state
- task/plan pane + file/editor pane
- compact model picker and Build action

#### CLI mock

- monospace body
- prompt region around 32px high
- 11–13px control labels
- follow-up input + model selector

#### Slack/Grok Bot mock

- 200–250px sidebar
- 400px+ main chat region
- 54px-ish chat list rows
- message input and tool controls

### Testimonials

Large quotes with restrained author attribution; no loud card decoration. Preserve generous white space and editorial rhythm.

### Frontier / enterprise cards

Three major capability blocks. Simple heading, body, text link, then mock UI. Avoid unnecessary shadows or gradients.

## 2.4 Section order

1. navbar
2. hero + Desktop/CLI product demo
3. trust headline
4. Agents / IDE demo
5. autonomous/cloud-agent demo
6. terminal / Slack / GitHub demo
7. AI teammate / Grok Bot demo
8. testimonials
9. Stay on the frontier feature blocks
10. enterprise block
11. changelog
12. applied-research / careers block
13. recent highlights
14. final CTA
15. footer

## 2.5 Interaction rules

- Clickable product-demo rows should change selected state and corresponding panel, not navigate away.
- File tabs are genuine selected/inactive controls.
- Model selectors are tiny dropdown-like controls.
- Nav hover is understated; links may underline.
- No exaggerated transforms, glowing shadows, glassmorphism, or pill-heavy UI.

---

# 3. Responsive behavior

The static reproductions use the following preservation strategy:

- `>= 1100px`: full observed desktop composition.
- `760–1099px`: collapse 3-column mock UIs to 2-column or stacked arrangements without changing the visual tokens.
- `< 760px`: hide low-priority marketing nav links, preserve primary CTA, make product mocks horizontally scrollable or stack rails above content.
- Typography scales with `clamp()` while retaining the original desktop target values.

# 4. Pixel-review checklist

For every reproduction pass:

- [ ] navbar height within 2px of target
- [ ] page background / card background correct
- [ ] hero max width and line breaks visually match source
- [ ] CTA height, radius, border, and weight match
- [ ] section top/bottom whitespace not compressed
- [ ] product mock proportions match source before adding details
- [ ] thin borders used instead of large shadows
- [ ] active/inactive tabs clearly reproduce source hierarchy
- [ ] mobile changes only reflow; they do not introduce a new design language

# 5. Implementation files

- ChatCut tokens and primitives: `chatcut/design-system.css`
- ChatCut reproduction: `chatcut/index.html`
- Cursor tokens and primitives: `cursor/design-system.css`
- Cursor reproduction: `cursor/index.html`

These files are intended as visual references for future implementation work. When the live sites change, create a new dated snapshot rather than silently modifying this one.
