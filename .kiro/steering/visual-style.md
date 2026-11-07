---
inclusion: always
---

# Visual style

Match `concept/haunt-any-page.html`. Mood: an old book read by candlelight in a foggy night. Spooky but readable, never gory.

## Popup tokens (define on `:root` in `src/popup/popup.css`)

| Token | Value | Use |
|---|---|---|
| `--night` | `#0b0c0f` | popup page background |
| `--stone` | `#17191f` | panel background |
| `--stone-hi` | `#20232b` | pressed button, hover |
| `--bone` | `#e9e3d2` | main text |
| `--ash` | `#8f9199` | secondary text, labels |
| `--candle` | `#ffb04a` | accent, primary button, focus ring, checkbox and slider `accent-color` |
| `--candle-ink` | `#1a1205` | text on the candle button |

- Popup width 280 px, padding 18 px, gap 14 px, border radius 12 px, `color-scheme: dark`.
- Title in IM Fell DW Pica 20 px; controls and labels in the system monospace stack `ui-monospace, Menlo, monospace` at 14 px (12 px for labels). Do not load IBM Plex Mono from the web.
- Primary button: candle background, candle-ink text; when pressed (`aria-pressed="true"`) stone-hi background, bone text.
- Focus: `outline: 2px solid var(--candle); outline-offset: 2px` on every interactive element.
- Every text color / background pair must pass 4.5:1. `scripts/check-contrast.mjs` enforces this on save.

## Skin on the page

- Light pages are inverted with `invert(1) hue-rotate(180deg)` plus a warm `sepia` and slight darkening, so text becomes bone on near-black. Media is flipped back and made grey-sepia and dim.
- The filter keeps hues, so blue links would stay blue. On light pages give prose links (`:where(p, li, dd, figcaption, blockquote) a:not([role="button"])`) `color: #8a4a00 !important`: after the filter this dark amber shows as candle orange. On dark pages use `#ffb04a`. Do not recolor every link: button-like links and colored nav bars lose contrast.
- CSS gradient backgrounds are not counter-filtered; that is fine (they turn dark and moody).
- Fog must look like drifting wisps, never a single soft blob: layered noise clouds, denser near the bottom, slowly sliding at different speeds. Reference: `concept/haunted-github.png`. Details in design.md.
- Bats: solid near-black (`#06060a`) SVG silhouettes using the path from the concept, 26 to 60 px wide, with a candle glow so they show on dark pages. They fly across the whole viewport in any direction on random diagonal swooping paths, bank into turns (max ±45°), face the way they fly and flap their wings. Five or six at a time.

## Popup layout

Reference: `concept/popup-and-icon.png`. Top to bottom, 290 px wide:

1. Header: the icon (28 px, 7 px radius), the title "Haunt Any Page" in IM Fell 21 px, an ON/OFF pill on the right (ON: `#3a2a12` background, candle text; OFF: stone-hi background, ash text).
2. The site origin in ash, 12 px, one line with ellipsis.
3. Primary button: "Haunt this page" (candle) / "Restore the page" (stone-hi with a thin candle inset border).
4. "EFFECTS" section label (11 px, letter-spaced, uppercase, ash), then rows with the label on the left and the checkbox on the right: Fog, Fog density slider (indented, shows its value), Bats, Old-book font, Candle flicker.
5. A divider, then "Always haunt this site" with the hint "Opens haunted every visit".
6. Footer in ash, 11 px, centered: "Nothing leaves your browser".

## Icon

Source: `concept/icon.svg`. A rounded night tile (`#0b0c0f`, radius 28/128) with a glowing candle-orange moon and a black bat across it, and a faint fog line at the bottom. Export PNGs at 16, 32, 48 and 128 px into `assets/icons/`. It must stay readable at 16 px in the toolbar.
- Candle flicker: a dark vignette at the edges whose opacity steps; it must not dim more than 30% and must not change more than 3 times per second.
- Respect `prefers-reduced-motion: reduce`: static fog, no bats, no flicker.
