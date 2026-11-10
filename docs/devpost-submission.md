# Devpost Submission Copy — Haunt Any Page (Kiroween 2026)

Use the sections below directly in the Devpost submission form.

---

## Basic Info

- **Project Name**: Haunt Any Page
- **Elevator Pitch (Tagline)**: One click turns any website into a candle-lit, bat-filled, fog-draped haunted edition of itself—and restores it cleanly whenever you want.
- **Category**: Costume Contest
- **Built With**: `kiro`, `javascript`, `chrome-extension`, `manifest-v3`, `css3`, `html5`, `canvas`, `shadow-dom`, `web-animations-api`, `puppeteer`
- **Public GitHub Repository**: `https://github.com/phasepoemshield/haunt-any-page`
- **Test Build / Release ZIP**: `https://github.com/phasepoemshield/haunt-any-page/releases/download/v0.1.0/haunt-any-page-v0.1.0.zip`
- **Demo Video File (1:39, 720p60)**: `/Users/timur/Movies/HauntAnyPage-demo/haunt-any-page-demo.mp4` (also attached at `https://github.com/phasepoemshield/haunt-any-page/releases/download/v0.1.0/haunt-any-page-demo.mp4` — upload to YouTube as Unlisted/Public and paste the YouTube URL into Devpost)

---

## Project Story (Copy & Paste Markdown)

### Inspiration
Most dark-mode or seasonal browser extensions either break complex modern websites, demand invasive `<all_urls>` permissions at install time, or look like generic "AI slop" packed with neon glows and gradients. For Kiroween 2026's **Costume Contest**, we wanted to dress up the entire web like an old book read by candlelight on a foggy night—while keeping every page readable, interactive, and 100% private.

### What it does
**Haunt Any Page** is a zero-dependency Manifest V3 Chrome extension that transforms any webpage with a single click:
- **Candle-lit palette**: Turns light pages into bone-on-charcoal parchment while counter-filtering photos and videos so media stays natural. Already-dark sites (like GitHub Dark, Discord, or MDN) are automatically detected via WCAG relative luminance (`< 0.2`) and gently tinted rather than inverted.
- **Flying bats**: Six SVG bats with articulated two-joint wings (shoulder, elbow, wrist, and scalloped fingertips) driven by a real-time flight simulation—complete with lift on each downstroke, erratic insect-chasing darts, pairwise separation, and a 3×2 viewport grid so they never bunch into a flock.
- **Old-book typography**: Applies bundled *IM Fell DW Pica* to prose and headings while excluding `code`, `pre`, form controls, SVGs, and icon fonts.
- **Candle flicker**: A subtle `steps(1)` edge vignette that dims by at most 30% and steps at most 3 times per second.
- **Independent Weather (Fog)**: Three layers of seamless periodic 5-octave fractal value noise rendered into `<canvas>` tiles that drift at independent speeds. Fog has its own **Density**, **Speed**, and **Height** sliders, adapts its palette to light or dark pages, and works on any page—even when the haunted skin is off.
- **Instant, clean restore**: A second click removes every class, font face, and overlay element so `document.documentElement.outerHTML` matches the original DOM.
- **Remember this site**: Uses `optional_host_permissions` per origin (`chrome.permissions.request`) and `chrome.scripting.registerContentScripts` at `document_start` only for sites the user explicitly chooses.

### How we built it (and how Kiro was used)
We built the entire project in **Kiro IDE** using its spec-driven workflow, steering documents, and automated `PostFileSave` hooks (see [`docs/kiro-usage.md`](https://github.com/phasepoemshield/haunt-any-page/blob/main/docs/kiro-usage.md) for the full write-up):

1. **Specs (`.kiro/specs/haunt-any-page/`)**:
   - `requirements.md`: Defined EARS acceptance criteria (`WHEN ... THE SYSTEM SHALL ...`) covering one-click haunt/restore, effects, independent Weather fog, per-site memory, zero-network privacy, and WCAG AA accessibility.
   - `design.md`: Specified the three-part MV3 architecture (popup, content script, service worker), the exact 5-octave periodic noise math, the articulated bat wingbeat geometry, and closed Shadow DOM isolation with `adoptedStyleSheets`.
   - `tasks.md`: Broke the build into 9 ordered tasks gated by `npm test` and `npm run check`.

2. **Steering (`.kiro/steering/`)**:
   - `product.md`: Locked scope to a fast, dependency-free MV3 extension with zero external requests.
   - `visual-style.md`: Enforced strict **"No AI slop"** design rules (flat `#161412` surface, `#ece6d8` bone ink, `#d4553f` wax-seal accent, left-aligned layout, *Grenze Gotisch* wordmark + *Atkinson Hyperlegible* body, zero neon glows or decorative gradients).
   - `extension-rules.md`: Enforced minimal permissions (`activeTab`, `scripting`, `storage`), closed Shadow DOM, `createElementNS` (no `innerHTML`), and `chrome.storage.local` only.

3. **Agent Hooks (`.kiro/hooks/`)**:
   Three `PostFileSave` hooks ran automatically on every save:
   - `check-manifest.json` → `scripts/check-manifest.mjs`: Rejects MV2 fields, broad permissions (`tabs`, `<all_urls>`, `webRequest`), missing asset files, or unsafe `web_accessible_resources`.
   - `check-contrast.json` → `scripts/check-contrast.mjs`: Parses CSS rules and verifies every foreground/background pair meets WCAG AA (`>= 4.5:1`).
   - `check-privacy.json` → `scripts/check-privacy.mjs`: Scans `src/` to block `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, `new Function`, `chrome.storage.sync`, and remote URLs.

### Challenges we ran into
- **Strict Content Security Policies (CSP)** on sites like GitHub and YouTube block inline `<style>` tags and data URLs. We solved this by attaching closed shadow roots (`mode: 'closed'`), styling them via `new CSSStyleSheet()` + `shadow.adoptedStyleSheets`, drawing fog directly to `<canvas>` elements, and loading bundled fonts via the `FontFace` API.
- **Seamless fog wisps**: Wrapping coordinates (`x % tileWidth`) created a visible vertical seam as fog drifted. Wrapping the noise lattice period itself (`period = scale * 2^octave`) produced seamlessly tiling wisps across a 200%-wide canvas.
- **Dark-page race conditions at `document_start`**: When auto-haunting a remembered site at `document_start`, `<body>` and page stylesheets aren't loaded yet, making dark sites appear transparent. We added tone re-checks on `DOMContentLoaded`, `load`, and post-load while temporarily ignoring our own `haunt-on` root class during sampling.

### Accomplishments that we're proud of
- **Zero-trace restoration**: Verified by an automated Puppeteer E2E test (`npm run test:e2e`) that compares `document.documentElement.outerHTML` before haunting and after restoring.
- **Crafted popup UI**: A quiet, utilitarian tool that passes automated WCAG AA contrast checks (`check-contrast.mjs`) and avoids every cliché of generic AI UI generation.
- **Zero network activity**: Everything—fonts, icons, noise generator, bat physics—is bundled locally and verified by `check-privacy.mjs` and Puppeteer request interception.

### What we learned
Combining Kiro's EARS requirements with executable `PostFileSave` hooks turns architectural rules (like WCAG AA contrast and zero-network privacy) from aspirational guidelines into hard invariants that are verified on every single file save.

---

## Installation Instructions (for Judges)

1. Download [`haunt-any-page-v0.1.0.zip`](https://github.com/phasepoemshield/haunt-any-page/releases/download/v0.1.0/haunt-any-page-v0.1.0.zip) and unzip it (or clone `https://github.com/phasepoemshield/haunt-any-page.git`).
2. Open `chrome://extensions/` in Chrome, Edge, or Brave.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extracted folder.
5. Open any `http`/`https` webpage (e.g., `https://en.wikipedia.org`), click the **Haunt Any Page** toolbar icon, and click **Haunt this page** or toggle **Weather → Fog**.
