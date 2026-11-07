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
  "defaults": { fog: true, fogDensity: 55, bats: true, font: true, flicker: false },
  "sites": {
    "https://en.wikipedia.org": {
      haunted: true, fog: true, fogDensity: 55, bats: true, font: true, flicker: false, remember: true
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
6. On "Always haunt this site" checked: `chrome.permissions.request({ origins: [origin + '/*'] })` directly inside the click handler (it needs a user gesture). On deny, uncheck. On uncheck: `chrome.permissions.remove(...)` and save `remember: false`.

## Background (`src/background.js`)

- On `runtime.onInstalled`, `runtime.onStartup`, `storage.onChanged` (key `sites`) and `permissions.onAdded/onRemoved`, call `syncRegistrations()`.
- `syncRegistrations()` builds `matches = origins where remember === true && haunted === true && chrome.permissions.contains({origins:[o+'/*']})`, then unregisters the script with id `haunt-remembered` and, if `matches` is not empty, registers it again with `js: ['src/content/haunt.js']`, `css: ['src/content/haunt.css']`, `runAt: 'document_start'`, `persistAcrossSessions: true`.
- The content script, when loaded this way, reads its own settings from storage and applies them (`chrome.storage` is available in content scripts).

## Content script (`src/content/haunt.js`)

- Wrapped in an IIFE with a guard: `if (window.__hauntAnyPage) return;` then `window.__hauntAnyPage = { apply, restore }`. Running it twice is safe (Req 1.4).
- Listens for `haunt:apply` and `haunt:restore` messages.
- `apply(settings)`:
  - On `document.documentElement` sets class `haunt-on` and toggles `haunt-fog`, `haunt-bats`, `haunt-font`, `haunt-flicker`, `haunt-dark-page`; sets `--haunt-fog` to `fogDensity / 100`.
  - Detects an already dark page once `document.body` exists (Req 2.6) and sets `haunt-dark-page`.
  - Creates the overlay once: `<haunt-any-page-overlay aria-hidden="true">` appended to `documentElement` with a closed shadow root that holds its own `<style>` plus the fog layers, four SVG bats (the path from the concept) and the candle vignette. Bat SVGs are built with `createElementNS`, never with `innerHTML` of page-derived strings.
  - Adds an `@font-face` for the bundled font with `chrome.runtime.getURL('assets/fonts/...')` in a `<style id="haunt-any-page-font">` in `<head>`.
- `restore()` removes the classes, the custom property, the overlay element and the font style. After restore `document.documentElement.outerHTML` equals the value captured before the first apply, apart from changes the page made itself (Req 1.3).

## Skin (`src/content/haunt.css`)

Every selector is scoped under `html.haunt-on` so the file is inert until applied.

- Palette, light pages: `html.haunt-on:not(.haunt-dark-page) { filter: invert(1) hue-rotate(180deg) sepia(.35) brightness(.88) contrast(.95); background: #fff; }`. Media is flipped back so photos are not negatives: `img, video, picture, canvas, iframe, svg image, [style*="background-image"]` get `filter: invert(1) hue-rotate(180deg) grayscale(.6) sepia(.4) brightness(.7)`.
- Links: the filter keeps hues, so on light pages links get `color: #8a4a00 !important`, which shows as candle orange after the filter. On dark pages links get `#ffb04a`.
- Dark pages: `html.haunt-on.haunt-dark-page { filter: sepia(.35) brightness(.9); }`.
- This technique was checked in headless Chrome on a test article before implementation: sticky headers stay sticky (filter on the root element does not break `position: fixed/sticky`), the overlay does not block clicks, code keeps its monospace font, and restore gives back an identical `outerHTML`.
- Font: `html.haunt-on.haunt-font :where(body, p, li, h1, h2, h3, h4, h5, h6, a, blockquote, td, th, dd, dt, figcaption, label, article, section)` gets `font-family: "Haunt Fell", Georgia, serif !important`. Exclusions with `:not()` for `code, pre, kbd, samp, input, textarea, select, [class*="icon"], [aria-hidden="true"]`.
- Overlay host: `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;` and on light pages the same `invert(1) hue-rotate(180deg)` counter-filter so fog and bats keep their real colors.
- Fog: two radial gradients from the concept, `mix-blend-mode: screen`, opacity `var(--haunt-fog)`, 14 s `drift` animation.
- Bats: the concept's `fly` animation, 9 s, four bats at different heights and delays.
- Flicker: animates the vignette's opacity with `steps(1)` keyframes (at most 3 changes per second, dimming at most 30%), not the page filter, so it is cheap.
- `@media (prefers-reduced-motion: reduce)`: no animations, bats hidden (Req 5.1).

## Error handling

- Every `chrome.*` call in the popup is awaited inside `try/catch`; failures show the "can't be haunted" state rather than throwing.
- `sendMessage` to a tab without the script (for example after a reload) re-injects the script once and retries.

## Testing strategy

- Unit tests (`node --test`): settings defaults/merge, origin keying, and the check scripts in `scripts/`.
- E2E smoke test (`tests/e2e.test.mjs`, Puppeteer + Chrome for Testing, launched with `--load-extension`): opens `tests/fixtures/page.html` from a local static server, injects through the extension, asserts the classes and overlay exist, restores, and asserts `outerHTML` equals the original.
- Manual checklist in `README.md` on Wikipedia, GitHub, a news site and an already dark site.
