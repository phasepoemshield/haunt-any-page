# Implementation plan: Haunt Any Page

Work through the tasks in order. After each task run `npm test` and `npm run check`; both must pass before the task is marked done.

- [x] 1. Project skeleton and manifest
  - Create `manifest.json` exactly as in design.md, and the empty files from the file layout.
  - Add fonts from the Google Fonts repository with their `OFL.txt`: IM Fell DW Pica regular and italic (`ofl/imfelldwpica`, page effect), Grenze Gotisch (`ofl/grenzegotisch`, popup wordmark), Atkinson Hyperlegible regular and bold (`ofl/atkinsonhyperlegible`, popup text). Export `concept/icon.svg` to PNG icons at 16, 32, 48 and 128 px in `assets/icons/`.
  - `npm run check` passes.
  - _Requirements: 4.1, 4.3_

- [x] 2. Shared settings module
  - `src/shared/settings.js`: `DEFAULTS`, `originOf(url)`, `loadSite(origin)`, `saveSite(origin, patch)`, `loadAllSites()`.
  - Unit tests in `tests/settings.test.mjs` with a tiny in-memory fake of `chrome.storage.local`.
  - _Requirements: 3.1, 3.2, 4.4_

- [x] 3. Skin style sheet
  - `src/content/haunt.css` as in design.md: palette filter, media counter-filter, dark-page variant, font override with exclusions, overlay host.
  - Everything scoped under `html.haunt-on`.
  - _Requirements: 1.6, 2.5, 2.8_

- [x] 4. Content script: apply and restore
  - `src/content/haunt.js` with the idempotent guard, message listener, `apply(settings)` and `restore()`.
  - Overlay in a closed shadow root: bats with Web Animations flights, candle vignette; reduced-motion rules inside the shadow style. Follow the numbers in design.md.
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 2.3, 2.6, 2.7, 5.1, 5.3_

- [x] 5. Popup UI
  - `src/popup/popup.html` + `popup.css` matching `concept/popup.png` and the "Popup" and "No AI slop" sections in steering/visual-style.md: icon and wordmark, status sentence, primary button, effect rows, a Weather section with the Fog checkbox and Density, Speed and Height sliders, "Remember this site" with its hint.
  - Keyboard usable, visible focus ring, `aria-pressed` on the primary button.
  - _Requirements: 1.1, 2.1, 2.2, 5.2, 5.4_

- [x] 6. Popup logic
  - `src/popup/popup.js`: detect the tab, unsupported-page state, load/render settings, haunt/restore through `chrome.scripting`, live option updates, save on change.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.3, 2.4, 3.1, 3.2_

- [x] 7. Remember per site
  - "Remember this site": `chrome.permissions.request/remove` in the click handler.
  - `src/background.js`: `syncRegistrations()` with `chrome.scripting.registerContentScripts` (`id: haunt-remembered`, `runAt: document_start`).
  - Content script loaded at `document_start` reads its own settings and applies them.
  - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [x] 8. End-to-end smoke test
  - `tests/fixtures/page.html` (a plain light article like the concept) and `tests/e2e.test.mjs` with Puppeteer: load the unpacked extension, haunt the fixture through the content script, assert classes and overlay, restore, assert the DOM equals the original, assert no network requests were made by the extension.
  - Add `puppeteer` as a dev dependency and an `npm run e2e` script. Use Chrome for Testing (`npx @puppeteer/browsers install chrome@stable`): branded Chrome no longer loads unpacked extensions from the command line.
  - Optional real-site pass (not in CI): YouTube, Wikipedia, GitHub, BBC News, Hacker News, Discord, MDN; save screenshots for the demo.
  - _Requirements: 1.3, 1.4, 4.2_

- [x] 9. README, store text and demo prep
  - README: what it is, install with "Load unpacked", permissions explained, manual test checklist, screenshots, license.
  - `docs/kiro-usage.md`: how specs, steering and hooks were used while building (fill in as you go).
  - _Requirements: all_
