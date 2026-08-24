# ECI Moonlight AR — V2.2 Responsive UI

This is the ECI Mid-Autumn Web AR experience. Current phase (V2.2): the four
core screens — Welcome, AR Studio, Draw Editor, Greeting Card — rebuilt on a
single, non-conflicting responsive architecture. Camera preview (getUserMedia)
is wired up as a live preview only; face tracking / MediaPipe / AR headband
placement is the next phase and has **not** been started.

Open `index.html` (served over HTTP/HTTPS — `file://` blocks camera access)
to review the flow:

1. Welcome
2. AR Studio (style / color / pattern / draw / text / capture)
3. Draw editor
4. Greeting card (SAVE / SHARE / DESIGN AGAIN)

## Files

- `index.html` — markup for all four screens, language sheet, toast, hidden capture canvas
- `styles.css` — all styling; see the architecture note at the top of the file
- `app.js` — i18n, camera preview, headband state, draw editor, capture compositing, greeting-card export
- `assets/` — product photography and decorative art (moon, headband, rabbit, cloud, plum, logo)

`index.current.html` is the previous single-file prototype that had the
responsive/overlap bug described below. It has been superseded by the three
files above and is kept only for reference — it is not linked from anywhere
and can be deleted once you've confirmed the new build covers everything you need.

## Responsive architecture

Mobile-first flow — Flexbox/Grid, `clamp()`, `dvh`, and `env(safe-area-inset-*)`
— not a fixed 9:16 viewport. Absolute positioning is used only for two
legitimate, contained cases:

1. **AR Studio overlays** — the camera fills the screen, so the header, band
   preview, tool sheet and capture dock are necessarily layered on top of it.
   There is no "flow" for a full-bleed camera layer.
2. **Welcome's decorative art** — `.welcome-visual` is one bounded,
   `aspect-ratio`-constrained box; every image inside it is positioned as a
   percentage of *that box*, never the viewport. The box then sits in normal
   document flow next to (desktop) or above (mobile) the copy block, so it
   can never collide with the title/CTA outside it.

Breakpoints: `<700px` mobile stacked · `700–899px` tablet stacked (larger
scale) · `≥900px` with `≥560px` height → two-column desktop/landscape Grid
(art left, copy right), per the ECI brand brief.

The old prototype's bug — Moon / Headband / "MID-AUTUMN" text overlapping at
wide viewports — came from the same selectors being redeclared across many
stacked `@media` blocks (visible in `index.current.html`'s CSS history:
"V2.2 art direction", then "Original ECI direction", then two more override
passes on top). Each pass alone made sense; together they fought over the
same elements at different breakpoints. This rebuild has exactly one
declaration per selector per breakpoint.

## Verified

Automated (geometry-based, not just visual) responsive QA passed at
390×844, 430×932, 768×1024 and 1440×900 for all four screens: no element
overlaps, every interactive control stays within the viewport, and touch
targets are ≥44px. Language switching (EN/繁/简) preserves the active screen
and the current headband design (style/color/pattern/text/drawing) — it
never reloads or resets state. The greeting-card export is a fixed
1080×1920 JPEG.

## Current limitation

The AR headband is a CSS/canvas mock, not tracked to a face. Capture
composites the camera frame + headband (color/pattern/drawing/text) into one
image; there is no face-anchored positioning yet — that starts in phase two
(HTTPS camera testing → MediaPipe Face Landmarker → forehead landmarks →
headband position/scale/rotation → occlusion → capture integration), which
has not been started per the agreed scope for this phase.
