# Design: Haunt Any Page

## Overview

A plain-JavaScript Manifest V3 extension with no build step and no dependencies. Three parts talk through `chrome.storage.local` and `chrome.tabs.sendMessage`:

```
 popup (src/popup)  ──insertCSS/executeScript──▶  content script (src/content) in the tab
        │   ▲                                         ▲
        │   └──── sendMessage {type, settings} ───────┘
        ▼
 chrome.storage.local  ◀── storage.onChanged ──  background service worker (src/background.js)
                                                  keeps registerContentScripts in sync
                                                  for remembered sites
```

## File layout

```
manifest.json
src/
  shared/settings.js     defaults, storage keys, load/save helpers (ES module)
  popup/popup.html       popup markup
  popup/popup.css        popup styles (tokens from steering/visual-style.md)
  popup/popup.js         popup logic (ES module)
  content/haunt.css      the skin: palette filter, font override, overlay host
  content/haunt.js       applies/updates/restores the skin, builds the overlay
  background.js          service worker: syncs dynamic content scripts
assets/
  fonts/IMFellDWPica-Regular.ttf, IMFellDWPica-Italic.ttf, OFL.txt
  icons/icon-16.png, icon-32.png, icon-48.png, icon-128.png
tests/                   node --test unit tests + e2e smoke test
```

## Manifest

```json
{
  "manifest_version": 3,
  "name": "Haunt Any Page",
  "version": "0.1.0",
  "description": "One click turns any website into a haunted version of itself. Click again to restore it.",
  "permissions": ["activeTab", "scripting", "storage"],
  "optional_host_permissions": ["https://*/*", "http://*/*"],
  "background": { "service_worker": "src/background.js", "type": "module" },
  "action": { "default_popup": "src/popup/popup.html", "default_icon": { "16": "...", "32": "..." } },
  "icons": { "16": "...", "48": "...", "128": "assets/icons/icon-128.png" },
  "web_accessible_resources": [
    { "resources": ["assets/fonts/*"], "matches": ["<all_urls>"], "use_dynamic_url": true }
  ]
}
```

`npm run check` (and the Kiro hooks) validate these rules automatically.

## Data model

`chrome.storage.local`:

```js
{
  "defaults": { bats: true, font: true, flicker: false },
  "sites": {
    "https://en.wikipedia.org": {
      haunted: true, bats: true, font: true, flicker: false, remember: true,
      weather: { fog: true, fogDensity: 55, fogSpeed: 50, fogHeight: 60 }
    }
  }
}
```

The key is `new URL(tab.url).origin`. Only origins and booleans/numbers are stored, never URLs with paths or page content.

## Popup flow (`src/popup/popup.js`)

1. Get the active tab with `chrome.tabs.query({ active: true, currentWindow: true })`. If its URL is not `http(s)` or scripting fails, show "This page can't be haunted" and disable controls (Req 1.5).
2. Load settings for the origin (fall back to `defaults`) and render them.
3. On "Haunt this page": `chrome.scripting.insertCSS({ files: ['src/content/haunt.css'] })`, then `chrome.scripting.executeScript({ files: ['src/content/haunt.js'] })`, then `chrome.tabs.sendMessage(tab.id, { type: 'haunt:apply', settings })`. `activeTab` grants this access because the user clicked the action.
4. On "Restore the page": `sendMessage({ type: 'haunt:restore' })`, then `chrome.scripting.removeCSS(...)`.
5. On any option change: save, and if haunted, `sendMessage({ type: 'haunt:apply', settings })`.
6. On "Remember this site" checked: `chrome.permissions.request({ origins: [origin + '/*'] })` directly inside the click handler (it needs a user gesture). On deny, uncheck. On uncheck: `chrome.permissions.remove(...)` and save `remember: false`.

## Background (`src/background.js`)

- On `runtime.onInstalled`, `runtime.onStartup`, `storage.onChanged` (key `sites`) and `permissions.onAdded/onRemoved`, call `syncRegistrations()`.
- `syncRegistrations()` builds `matches = origins where remember === true && haunted === true && chrome.permissions.contains({origins:[o+'/*']})`, then unregisters the script with id `haunt-remembered` and, if `matches` is not empty, registers it again with `js: ['src/content/haunt.js']`, `css: ['src/content/haunt.css']`, `runAt: 'document_start'`, `persistAcrossSessions: true`.
- The content script, when loaded this way, reads its own settings from storage and applies them (`chrome.storage` is available in content scripts).

## Content script (`src/content/haunt.js`)

- Wrapped in an IIFE with a guard: `if (window.__hauntAnyPage) return;` then `window.__hauntAnyPage = { apply, restore }`. Running it twice is safe (Req 1.4).
- Listens for `haunt:apply` and `haunt:restore` messages.
- `apply(settings)`:
  - On `document.documentElement` sets class `haunt-on` and toggles `haunt-bats`, `haunt-font`, `haunt-flicker`, `haunt-dark-page`.
  - Detects an already dark page once `document.body` exists (Req 2.8) and sets `haunt-dark-page`.
  - Creates the overlay once: `<haunt-any-page-overlay aria-hidden="true">` appended to `documentElement` with a closed shadow root that holds the six SVG bats (the path from the concept) and the candle vignette. The shadow styles are a constructed `CSSStyleSheet` assigned to `shadowRoot.adoptedStyleSheets` (not a `<style>` element), so strict page CSPs cannot block them. Bat SVGs are built with `createElementNS`, never with `innerHTML` of page-derived strings.
  - Loads the bundled font with the FontFace API: `const face = new FontFace('Haunt Fell', \`url("${chrome.runtime.getURL('assets/fonts/IMFellDWPica-Regular.ttf')}")\`); document.fonts.add(face);`. No `<style>` element and no `__MSG_@@extension_id__` URL (that static URL does not work with `use_dynamic_url: true`).
- `restore()` removes the classes, the custom property and the overlay element, and calls `document.fonts.delete(face)`. After restore `document.documentElement.outerHTML` equals the value captured before the first apply, apart from changes the page made itself (Req 1.3).

## Skin (`src/content/haunt.css`)

Every selector is scoped under `html.haunt-on` so the file is inert until applied.

- Palette, light pages: `html.haunt-on:not(.haunt-dark-page) { filter: invert(1) hue-rotate(180deg) sepia(.35) brightness(.88) contrast(.95); background: #fff; }`. Media is flipped back so photos are not negatives: `img, video, picture, canvas, iframe, svg image, [style*="background-image"]` get `filter: invert(1) hue-rotate(180deg) grayscale(.6) sepia(.4) brightness(.7)`.
- Links: the filter keeps hues, so on light pages prose links get `color: #8a4a00 !important`, which shows as candle orange after the filter; on dark pages `#ffb04a`. Only links inside prose: `:where(p, li, dd, figcaption, blockquote) a:not([role="button"])`. Recoloring every `a` broke contrast on button-like links and colored bars (Discord, Hacker News).
- Dark pages: `html.haunt-on.haunt-dark-page { filter: sepia(.35) brightness(.9); }`.
- Font: `html.haunt-on.haunt-font :where(body, body *):not(code, code *, pre, pre *, kbd, samp, input, textarea, select, svg, svg *, math, i, [class*="icon"], [class*="symbol"], [class*="fa-"], [aria-hidden="true"])` gets `font-family: "Haunt Fell", Georgia, serif !important`. A list of text tags is not enough: YouTube, GitHub and others put text in `div`, `span` and custom elements.
- Overlay host: `position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 2147483647; display: block` (all `!important`), and on light pages the same `invert(1) hue-rotate(180deg)` counter-filter so fog and bats keep their real colors.
- Fog lives in Weather, not in the skin (see "Weather" below). Tuned details:
- Fog (wisps, not a blob): three layers of fractal value noise drawn once into small `<canvas>` elements inside the shadow root (no images, no data URLs, so page CSP cannot block them).
  - Noise: 5 octaves of value noise whose lattice wraps in x (period = base scale × octave frequency), so the tile repeats seamlessly; wrapping only the coordinate, as `x % tile`, leaves a visible seam. Octave k uses `period = scale · 2^k` and seed `seed + k`; sample at `(x/w · period, y/h · period · (h/w) · 2)`. Each canvas holds the same 320x140 tile twice side by side. Alpha = `clamp((n - threshold) / (1 - threshold)) ^ 1.1`, multiplied by `(0.35 + 0.65 · (y/h)^1.3)` so the fog is denser near the bottom, and by a smoothstep over the top 35% of the layer so shorter layers have no hard upper edge.
  - Layers (all values matter; the base scale is the number of noise cells across one 320px tile). Each is anchored to the bottom, 200% wide, and drifts `translateX(0 → -50%)` linearly:
    | Layer | Color | Seed | Scale | Threshold | Height | Opacity | Drift |
    |---|---|---|---|---|---|---|---|
    | bone | `#e9e3d2` | 11 | 3 | 0.36 | 100% | 0.55 | 110 s |
    | cool | `#cfe6df` | 23 | 4 | 0.30 | 75% | 0.9 | 70 s |
    | warm | `#e6d8bd` | 37 | 6 | 0.34 | 55% | 0.8 | 45 s, reversed |
  - A wrapper "breathes" (opacity 1 → .7, 12 s alternate). Density, speed and height are written straight to inline styles and to the drift animations' playback rate (no CSS variables, so there is no name to get wrong): root opacity = `min(1, density/100 · 1.35)`, root height = `15 + 0.85 · height` percent, playback rate = `0.25 + 1.5 · speed/100`. The 1.35 factor makes the default 55% match the approved look.
  - Building the canvases took 30 to 55 ms on real sites; do it once per page and keep the canvases.
- Bats: a small flight simulation in one `requestAnimationFrame` loop (cancelled on restore). Six bats, each an `<svg viewBox="-50 -50 100 100">` whose `transform` is `translate(x−50, y−50) rotate(tilt) scale(span/72)` and whose single `<path d>` is rebuilt every frame. Rejected earlier attempts, so do not repeat them: keyframed paths with a CSS `scaleY` flap ("like autumn leaves, no physics, no wings"), and a view from below rotated to the heading ("looks like a bird", bats bunched together).
  - Front view, the classic bat silhouette. Local frame x = right, y = down, body at (0, 0); the left wing mirrors x. The bat does not rotate to its heading; it only leans into horizontal motion: `tilt = clamp(vx / (2.2·cruise), ±0.45 rad)`.
  - Body (static subpaths): torso `M0 -5C3.6 -5 4 -1 3.6 3C3.2 7 1.6 9 0 9C-1.6 9 -3.2 7 -3.6 3C-4 -1 -3.6 -5 0 -5Z`, head `M3.2 -7.5a3.2 3.2 0 1 1 -6.4 0a3.2 3.2 0 1 1 6.4 0Z` (clockwise arcs; counter-clockwise ones punch a hole), ears `M1.2 -9.6L3.4 -14.2L3.1 -8.4ZM-1.2 -9.6L-3.4 -14.2L-3.1 -8.4Z`, feet `M1.2 8.4L2.4 11L0.6 9.6ZM-1.2 8.4L-2.4 11L-0.6 9.6Z`.
  - Wing skeleton (right wing): shoulder (3, −3), elbow (11, −7), wrist (19, −9), finger tips (36, −3), (30, 5), (20, 8), hip (4, 6). Outline: shoulder → elbow → wrist → outer tip, then three quadratic scallops tip → tip → tip → hip, each control point = edge midpoint pulled 38% toward the wrist.
  - Flap for phase φ: rotate elbow, wrist and tips around the shoulder by `arm = −0.95·sin φ` (negative raises the wing, y is down); then rotate the tips around the moved wrist by `hand = −0.75·sin(φ − 0.9)` (the hand lags); then fold the hand toward the wrist by `fold = 0.42·max(0, cos(φ − 0.3))` on the upstroke. One beat sweeps the wings from high above the head to well below the body (pose sheet: `concept/bat-wingbeat.png`).
  - Wingbeat 4.2 to 5.6 Hz × √(60/span). Each downstroke lifts the body (`ay −= 520·max(0, cos φ)`) against a constant sink of 165 px/s², so the bat bobs with every beat.
  - Steering: accelerate toward `cruise` along the direction to the target with gain 1.6 /s; cruise 90 to 150 px/s × span/60; speed capped at 1.8 × cruise.
  - Erratic flight: every 0.18 to 0.6 s add a sideways dart of 60 to 150 px/s at 0.8 to 1.6 rad off the current direction (bats chase insects).
  - Spread, never a flock: (a) separation, every pair closer than 180 px pushes apart with `520·(1 − d/180)` px/s²; (b) the viewport is split into a 3 × 2 grid and each new target is a random point in a cell no other bat is heading to; (c) bats spawn one at a time (about 1.1 s apart) and from the four edges in turn.
  - After 3 to 5 targets a bat flies far outside the viewport, waits 0.8 to 3.5 s hidden and respawns.
  - Span 46 to 80 px; smaller bats are more transparent (opacity 0.5 + span/130), reading as farther away.
  - Fill `#120e0c` with a thin moonlit rim `stroke: rgba(233,227,210,.22); stroke-width: .8` so they read on dark pages. No glow.
  - Each bat stays `visibility: hidden` until it first spawns; otherwise it flashes in the top-left corner when haunting starts (seen in a prototype).
- Flicker: animates the vignette's opacity with `steps(1)` keyframes (at most 3 changes per second, dimming at most 30%), not the page filter, so it is cheap.
- `@media (prefers-reduced-motion: reduce)`: no animations, bats hidden (Req 5.1).

## Validation on real sites (before implementation)

A throwaway prototype of this skin (same CSS, overlay and FontFace approach) was loaded as an unpacked extension in Chrome for Testing 157 and run on YouTube (home and search), Google, Wikipedia, GitHub, BBC News, Hacker News, Discord and MDN. Results:

- Skin, fog, bats and font applied on every site, including sites with strict CSP (GitHub, YouTube). Font status `loaded` everywhere.
- Already dark sites (GitHub in dark mode, Discord, MDN) were detected and only tinted, not inverted.
- Sticky headers stayed sticky, scrolling worked, the overlay never received clicks.
- After restore: no overlay, no `haunt-*` classes, root `filter: none`; Wikipedia looked identical to the original.
- Google Search showed a captcha to the automated browser; that is Google's bot check, not the extension. `chrome://` pages and the Chrome Web Store cannot be scripted by any extension (Req 1.5).

## Error handling

- Every `chrome.*` call in the popup is awaited inside `try/catch`; failures show the "can't be haunted" state rather than throwing.
- `sendMessage` to a tab without the script (for example after a reload) re-injects the script once and retries.

## Testing strategy

- Unit tests (`node --test`): settings defaults/merge, origin keying, and the check scripts in `scripts/`.
- E2E smoke test (`tests/e2e.test.mjs`, Puppeteer + Chrome for Testing, launched with `--load-extension`): opens `tests/fixtures/page.html` from a local static server, injects through the extension, asserts the classes and overlay exist, restores, and asserts `outerHTML` equals the original.
- Manual checklist in `README.md` on Wikipedia, GitHub, a news site and an already dark site.

## Weather (`src/content/haunt.js`)

- Separate host `<haunt-any-page-weather>` with its own closed shadow root, `z-index: 2147483646` (below the bats), so fog works on a page that is not haunted and is untouched by restore. `haunt.css` adds the same invert counter-filter for it on haunted light pages.
- Messages: `weather:apply` with `{ fog, fogDensity, fogSpeed, fogHeight }` and `weather:status` (replies `{ fog }`). The popup injects `haunt.js` itself when fog is switched on for a page that has no content script.
- Layer heights are a share of the fog root, which the Height slider sizes; the upper fade is baked into each canvas, so no height has a hard edge.
- Palette by tone. Dark or haunted pages: the table above. Normal light pages: slate grey `[98,108,122]`, `[84,100,110]`, `[112,106,98]`, thresholds +0.06 to +0.08 and alpha × 0.7, so there are clear gaps and no grey veil.
- Tone detection: the body does not exist at `document_start` and the page's style sheets may not be loaded, so the first render waits for `<body>` and the tone is checked again on `DOMContentLoaded`, on `load` and 1.5 s later (some pages switch to a dark theme in a script). The canvases are rebuilt only when the tone changes.
- Storage: `sites[origin].weather`, written by `saveWeather` and never overwritten by the skin settings.
- The background worker registers the content script for a remembered site when it is haunted or its fog is on.
