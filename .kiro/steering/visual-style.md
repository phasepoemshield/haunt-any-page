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
- Fog: two soft radial gradients (`#cfe6df` and `#e6d8bd`), `mix-blend-mode: screen`, slow 14 s drift.
- Bats: solid near-black (`#06060a`) SVG silhouettes using the path from the concept, 18 to 34 px wide, with a faint candle glow `drop-shadow(0 0 3px rgba(255,176,74,.55))` so they show on dark pages, 9 s flight across the viewport, never more than four.
- Candle flicker: a dark vignette at the edges whose opacity steps; it must not dim more than 30% and must not change more than 3 times per second.
- Respect `prefers-reduced-motion: reduce`: static fog, no bats, no flicker.
