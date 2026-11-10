---
inclusion: always
---

# Visual style

Mood: an old book read in a foggy night. Spooky but readable, never gory. The effect on the page carries the atmosphere; the popup is a quiet, well-made tool.

## No "AI slop"

The project owner rejected earlier popup drafts as generic AI design. These rules come from the anti-slop catalogues (github.com/yetone/kill-ai-slop, github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list, github.com/gabelul/pixelslop). They apply to everything in this repo:

- No glows: no colored `box-shadow` or `drop-shadow` halos, no glowing dots, no "spotlight" radial gradient behind content. Elevation, if any, is a hairline.
- One flat background per surface. No decorative gradients.
- Left-aligned layout. Do not center a stack of title, illustration, label and subtitle.
- Two typefaces with distinct roles (below). No monospace outside code. No italic subtitles under every item.
- No uppercase letter-spaced kicker labels ("EFFECTS"); whitespace and order introduce groups.
- No icon tiles or icons in tinted rounded squares. Text labels only in the popup.
- No ornaments or decorative dividers; one hairline only for a real structural break.
- No pills/badges for state. State is a plain sentence.
- Plain, specific copy. No "spells", "curses", "ingredients", slogans or taglines.
- Transitions only on the properties that change, 120 to 200 ms. No bounce, no pulse.

## Popup

Reference: `concept/popup.png` (off and on states). 300 px wide, padding 18/20/20 px.

Tokens on `:root` in `src/popup/popup.css`:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#161412` | the only background |
| `--ink` | `#ece6d8` | main text, primary button fill, slider |
| `--muted` | `#a8a194` | secondary text |
| `--line` | `#ece6d81f` | the single hairline |
| `--accent` | `#d4553f` | checked checkboxes and the focus ring, nothing else |
| `--accent-ink` | `#1a0d0a` | check mark on the accent |

Typography (bundled in `assets/fonts/`, OFL):

- Grenze Gotisch, 600, 26 px: only the wordmark "Haunt Any Page".
- Atkinson Hyperlegible 400/700, 15 px (13 px for hints): everything else.
- IM Fell DW Pica is not used in the popup; it is the "Old-book font" effect on pages.

Layout, top to bottom:

1. Header row: icon 26 px (radius 6) and the wordmark, left-aligned.
2. Status sentence, muted, with the origin in bold ink: "**en.wikipedia.org** looks normal." / "**en.wikipedia.org** is haunted."
3. Primary button, full width, radius 6, bold 15 px. Off: ink fill, `#161412` text, "Haunt this page". On: transparent with a 1 px inset ink border at 35% opacity, ink text, "Restore the page".
4. 22 px gap, then effect rows (label left, checkbox right, min height 38 px): Bats, Old-book font, Candle flicker.
5. 22 px gap, then the Weather group: a muted 13 px sentence-case label "Weather", the row Fog, and indented Density, Speed and Height slider rows (muted 13 px label, 2 px track, 14 px round thumb) shown only while Fog is checked. Weather works on a page that is not haunted, so it is not hidden then.
6. One hairline, then the row "Remember this site" with the hint "Haunt and weather come back on every visit. Chrome will ask once for access to this site. Settings stay on this device."

Controls: custom square checkboxes 18 px, radius 3, 1.5 px border at 50% ink; checked = accent fill with an accent-ink check mark. Focus: `outline: 2px solid var(--accent); outline-offset: 2px`. Every text/background pair passes 4.5:1 (`scripts/check-contrast.mjs` enforces it on save).

## Icon

Source: `concept/icon.svg`. Flat: a `#161412` rounded tile (radius 28/128) with a 1.5 px hairline border at 14% ink, a solid ink (`#ece6d8`) full moon, and the bat silhouette in the tile color fully inside the moon. No gradients, no glow. Export PNGs at 16, 32, 48 and 128 px into `assets/icons/`.

## Skin on the page

- Light pages are inverted with `invert(1) hue-rotate(180deg)` plus a warm `sepia` and slight darkening, so text becomes bone on near-black. Media is flipped back and keeps its colors (the page-wide sepia and dimming already tint it); do not add grayscale or a second sepia pass: thumbnails on YouTube came out colorless and hard to tell apart.
- The filter keeps hues, so blue links would stay blue. On light pages give prose links (`:where(p, li, dd, figcaption, blockquote) a:not([role="button"])`) `color: #8a4a00 !important`: after the filter this dark amber shows as a warm candle tone. On dark pages use `#ffb04a`. Do not recolor every link: button-like links and colored nav bars lose contrast.
- CSS gradient backgrounds are not counter-filtered; that is fine (they turn dark and moody).
- Fog (Weather) must look like drifting wisps, never a single soft blob: layered noise clouds, denser near the bottom, slowly sliding at different speeds. Reference: `concept/haunted-github.png`. Details in design.md.
- Bats must read as bats at a glance: the classic front-view silhouette (pointed ears, scalloped wings) with jointed wings that sweep from above the head to below the body, a body that bobs with each wingbeat, and an erratic, darting flight. They spread over the whole window and never move as a flock. Dark silhouettes with a thin moonlit rim (`stroke: rgba(233,227,210,.22)`), no glow. Details and rejected attempts in design.md; wingbeat reference `concept/bat-wingbeat.png`.
- Candle flicker: a dark vignette at the edges whose opacity steps; it must not dim more than 30% and must not change more than 3 times per second.
- Respect `prefers-reduced-motion: reduce`: static fog, no bats, no flicker.
