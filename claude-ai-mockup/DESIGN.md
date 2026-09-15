# Claude-inspired Product Demo Design System

> Source of truth for `claude-ai-mockup/`. This is an original, educational mockup inspired by publicly observable Claude/Anthropic design patterns. It is not an official Anthropic design system and must not imply affiliation.

## 1. Visual Theme & Atmosphere

Warm editorial utility. The product should feel calm, literate, restrained, and conversational rather than futuristic. The canvas should resemble premium paper more than a glowing software dashboard. Product chrome recedes so conversation, choices, and generated proof remain dominant.

Mood words: thoughtful, quiet, editorial, tactile, trustworthy, patient.

Avoid: neon gradients, cold blue-gray palettes, glassmorphism, excessive shadows, glossy 3D, gamified motion, over-rounded toy UI.

## 2. Color Palette & Roles

Use semantic tokens. Never place raw color values in component rules unless introducing a documented token here.

```css
--canvas: #f5f4ed;
--surface: #faf9f5;
--surface-raised: #fffefa;
--surface-muted: #efede5;
--surface-strong: #e8e5dc;

--ink: #1f1d1a;
--ink-secondary: #4d4943;
--ink-muted: #77716a;
--ink-faint: #9d968d;

--accent: #c96442;
--accent-hover: #b95839;
--accent-soft: #f1ddd3;
--accent-faint: #f7ebe5;

--success: #58715b;
--success-soft: #edf3ed;
--warning: #a66a31;
--danger: #a94b42;

--border: #ddd8cf;
--border-soft: #e9e5de;
--focus: #3b7fc4;
```

Color behavior:
- Canvas and sidebar use different warm neutrals, never pure gray.
- Accent is sparse: identity mark, active state, one primary action, small proof highlights.
- Primary text is warm near-black, not `#000`.
- Focus blue is allowed only for accessibility focus indication.

## 3. Typography Rules

No runtime font dependency. Use system/local fallbacks only.

```css
--font-editorial: Georgia, 'Times New Roman', serif;
--font-ui: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
```

Hierarchy:
- Hero: editorial serif, 40–48px desktop, 32px mobile, 500 weight, 1.08 line height.
- Section / artifact title: editorial serif, 26–32px, 500 weight.
- UI labels: sans, 12–14px, 500–650 weight.
- Body: sans, 15–16px, 1.6 line height.
- Metadata: sans or mono, 11–12px, muted.

Rules:
- Serif communicates ideas and generated artifacts.
- Sans communicates controls, navigation, and operational status.
- Mono is reserved for provenance, shortcuts, and machine-like metadata.

## 4. Component Stylings

### App sidebar
- Width: 272px desktop.
- Surface: `--surface-muted`.
- Divider: 1px `--border`.
- Navigation rows: 38–42px, 10–12px radius.
- Selected state: warm white surface with subtle inset/ring, never a saturated fill.

### Brand mark
- Original abstract sunburst/asterisk, not an official Claude logo.
- 28–32px container with terracotta foreground on `--accent-soft`.

### Buttons
- Default: quiet warm surface, 1px border, 10–12px radius.
- Primary: near-black fill with warm-white text.
- Accent is not the universal button fill. Reserve terracotta for key identity/action moments.
- Hover: one tonal step, no scale bounce.
- Pressed: subtle translateY(1px) or deeper border only.

### Prompt cards
- Editorial cards, not colorful tiles.
- Use title + one-line rationale + small directional glyph.
- Border on hover strengthens and the background raises one tonal step.

### Composer
- Raised warm-white surface.
- 20–24px radius.
- Thin warm border and restrained shadow.
- Input is visually dominant; controls form a quiet footer row.

### Conversation
- User message is compact and aligned to the right in a warm raised bubble.
- Assistant response is mostly borderless text, reinforcing editorial reading.
- Generated proof may use a contained result card with a status row.

### Artifact panel
- Separate reading surface with its own header, metadata, and document canvas.
- Document title uses editorial serif.
- Structure content into numbered sections or concise modules.
- Include a visibly simulated/local status indicator.

### Toasts
- Near-black pill, white text, 12px.
- Short-lived and nonessential; all important state must also exist in the page.

## 5. Layout Principles

Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.

Desktop:
- Sidebar: 272px.
- Chat content measure: 760px max.
- Composer measure: 800px max.
- Artifact: 480–620px, opened as a third pane.
- Keep generous dead space around welcome content.

Mobile (< 860px):
- Sidebar becomes an off-canvas sheet toggled from the top bar.
- Artifact becomes a full-height overlay panel.
- Suggestion cards stack.
- Composer stays fixed to bottom but must not create horizontal overflow.

## 6. Depth & Elevation

Use rings and warm shadows, not floating-card theater.

```css
--shadow-composer: 0 18px 50px rgba(45, 39, 32, .10), 0 1px 1px rgba(45, 39, 32, .05);
--shadow-panel: 0 22px 60px rgba(45, 39, 32, .12);
--ring-soft: 0 0 0 1px rgba(80, 71, 61, .08);
```

Only composer, artifact document, mobile sheets, and toast may use elevation.

## 7. Do / Don't

Do:
- Keep the interface warm, quiet, and text-led.
- Make every interactive control visibly update state.
- Use the artifact as proof that the assistant did work.
- Use semantic HTML, real buttons, labels, and focus states.
- Preserve the explicit “unofficial mockup / local simulation” disclaimer.
- Use original iconography and system fonts.

Don't:
- Copy Anthropic proprietary assets, fonts, logos, or exact product text.
- Pretend model responses are live API results.
- Use fake authentication, billing, or deployment-success flows.
- Put all tokens and component CSS back inside `index.html`.
- Introduce CDN fonts, JS libraries, analytics, or external assets.

## 8. Responsive Behavior

- Breakpoint: 860px for navigation transformation.
- Narrow layouts must satisfy `document.documentElement.scrollWidth <= innerWidth`.
- Minimum interactive target: 40px height where practical.
- Artifact overlay must have a keyboard-reachable close button.
- Mobile menu must close after selecting navigation or starting a chat.
- At `prefers-reduced-motion: reduce`, transitions are disabled.

## 9. Agent Prompt Guide

When extending this demo:
1. Read this `DESIGN.md` first.
2. Reuse semantic tokens from `styles/tokens.css`.
3. Reuse existing component classes from `styles/components.css` before inventing new patterns.
4. Preserve the product loop: prompt -> assistant state -> visible proof/artifact.
5. Keep runtime dependencies at zero unless a future architecture change explicitly requires them.
6. Verify desktop interaction, 375px mobile overflow, keyboard focus, and artifact open/close before claiming completion.

## Reference provenance

Direction informed by the public VoltAgent Awesome Claude Design collection and its Claude/getdesign.md entry, plus public Claude/Anthropic DESIGN.md analyses. Those references describe a warm parchment canvas, terracotta accent, serif-led editorial hierarchy, warm neutrals, restrained depth, and generous spacing. This file adapts those principles into an original mock product-demo system rather than reproducing an official interface.