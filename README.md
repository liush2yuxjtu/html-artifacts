# html-artifacts — a Claude skill

> Build a single **self-contained, interactive HTML artifact** — a report, slide
> deck, flowchart, design system, clickable prototype, code-review writeup,
> research explainer, or a throwaway editor UI — then save it to
> `~/.claude/artifacts/` and pop it open in the browser.

Markdown flattens things that are inherently spatial or interactive: a diff, a
module graph, a four-screen flow, a 30-ticket backlog. One self-contained HTML
file renders them *as themselves*, so a human can **react to the thing** instead
of imagining it from prose. This [Claude Code](https://claude.com/claude-code)
/ [Claude](https://claude.ai) skill teaches the model to build that file well —
modeled on a bundled library of 20 worked examples — and to drop it where you'll
see it.

## What's in here

```
html-artifacts/
├── SKILL.md            # the skill: workflow + reference index + house design system
├── scripts/
│   └── open-artifact.sh  # save HTML to ~/.claude/artifacts/ and `open` it
├── reference/          # 20 self-contained HTML examples (the quality bar)
│   ├── 01-exploration-code-approaches.html
│   ├── …
│   └── 20-editor-prompt-tuner.html
├── LICENSE             # Apache-2.0
└── NOTICE              # attribution for the bundled reference files
```

The 20 `reference/*.html` files span nine genres — exploration & planning, code
review & understanding, design, prototyping, illustrations & diagrams, decks,
research & learning, reports, and custom editing interfaces. SKILL.md carries the
full index mapping each genre to its example. The model reads the closest match
before building, so output matches a real quality bar instead of being generic.

## Install

This is a **user-level skill**. Clone (or copy) it into your Claude skills dir:

```bash
git clone https://github.com/liush2yuxjtu/html-artifacts.git \
  ~/.claude/skills/html-artifacts
```

Claude Code discovers any `~/.claude/skills/<name>/SKILL.md` automatically. No
build step, no dependencies. (For a project-scoped install instead, drop it under
`<repo>/.claude/skills/` and check it in.)

## Use it

Just ask for something you'd rather *see* than read:

- "make me a weekly status page from these notes"
- "turn this deploy pipeline into a clickable flowchart"
- "build a triage board for these 30 tickets, let me drag them, then copy the order out"
- "show me three layout directions for this landing page"
- "做成一页 HTML 弹开看看"

The skill picks the matching genre, builds one self-contained `.html`, saves it
to `~/.claude/artifacts/<slug>.html`, and opens it in your browser.

## Design language

The bundled examples share one restrained, editorial look (warm ivory paper, a
single clay accent, serif display headings over a sans body, mono for labels and
code). SKILL.md ships a copy-paste `:root` token block so new artifacts feel
native to the set. Everything is vanilla HTML/CSS/JS with inline SVG — no
frameworks, no CDN, fully offline, openable straight from a `file://` path.

## Credits & license

The 20 reference HTML files are from **[ThariqS/html-effectiveness](https://github.com/ThariqS/html-effectiveness)**
("The unreasonable effectiveness of HTML — examples"), © 2026 Anthropic PBC,
licensed under **Apache-2.0**, and are redistributed here **unmodified** with
their original per-file copyright headers intact. See [`NOTICE`](NOTICE).

The skill scaffolding (SKILL.md, scripts, this README) is © 2026 Liu Shiyu, also
licensed under **Apache-2.0**. See [`LICENSE`](LICENSE).
