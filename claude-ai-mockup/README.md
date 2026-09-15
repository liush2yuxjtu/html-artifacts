# Claude-inspired Product Demo

A reusable, dependency-free product demo rebuilt from the original single-file artifact.

## Structure

```text
claude-ai-mockup/
├── DESIGN.md              # visual source of truth
├── README.md              # architecture and verification notes
├── index.html             # semantic page/composition only
├── app.js                 # local demo state + interactions
└── styles/
    ├── tokens.css         # semantic color/type/spacing/elevation tokens
    └── components.css     # reusable component + responsive rules
```

## Design direction

The system is an original interpretation of publicly observable Claude/Anthropic patterns: parchment-like warm neutrals, sparse terracotta accents, serif editorial hierarchy, restrained depth, generous whitespace, and content-first interaction.

Reference direction came from the VoltAgent `awesome-claude-design` Claude entry / getdesign.md pattern. This project does not copy proprietary Claude fonts, screenshots, official logos, or private product assets.

## Product loop

```text
prompt / suggestion
  -> simulated assistant response
  -> visible result status + structured proof
  -> generated artifact panel
  -> model/state changes stay synchronized
```

No Anthropic API is called. All controls are local simulation for product-demo purposes.

## Extension rule

Read `DESIGN.md` before adding or restyling UI. Add new semantic values to `styles/tokens.css`; reuse or extend component patterns in `styles/components.css`; keep user-facing dynamic text in `app.js` rendered through text nodes.

## Verification targets

- deployed page and split CSS/JS assets return successfully
- suggestion -> response -> result loop works
- model change updates both response and artifact labels
- artifact opens/closes by keyboard-reachable controls
- new chat resets the visible state
- 375px viewport has no horizontal overflow
- no runtime CDN, analytics, external fonts, external images, or API dependency
