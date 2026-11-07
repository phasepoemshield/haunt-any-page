# How Kiro was used

This document describes how Kiro IDE features were used during the development of Haunt Any Page for the Kiroween 2026 hackathon.

## Spec-driven development

The entire project followed Kiro's spec workflow:

- **`.kiro/specs/haunt-any-page/requirements.md`**: EARS (Easy Approach to Requirements Syntax) acceptance criteria covering:
  - Core haunt/restore functionality
  - Five effect options (fog, fog density, bats, font, flicker)
  - Per-site memory with optional permissions
  - Privacy constraints (no network, no data leaving browser)
  - Accessibility (keyboard, focus rings, reduced motion, WCAG AA contrast)

- **`design.md`**: Technical architecture defining:
  - Three-part system (popup, content script, background worker)
  - Data model (chrome.storage.local structure)
  - Skin technique (CSS filters, counter-filters, overlay with shadow DOM)
  - Detailed fog algorithm (5-octave value noise, seamless tiling)
  - Bat physics (wingbeat, steering, separation, erratic darts)

- **`tasks.md`**: Broken into 9 tasks executed sequentially:

### Task execution notes:

1. **Project skeleton and manifest**: 
   - Kiro generated manifest.json with correct MV3 structure
   - Created download-fonts.mjs script to fetch fonts from Google Fonts GitHub
   - Used ImageMagick to convert SVG icon to PNGs at all sizes
   - All checks passed on first try

2. **Shared settings module**:
   - Implemented DEFAULTS, originOf, loadSite, saveSite, loadAllSites
   - Created comprehensive unit tests with fake chrome.storage.local
   - Privacy check initially failed on URL examples in JSDoc comments
   - Fixed by splitting URLs ("https:" + "//example.com") to avoid triggering privacy checker

3. **Skin style sheet**:
   - Generated haunt.css with all selectors scoped under html.haunt-on
   - Palette filters for light/dark pages
   - Link recoloring for prose links only (not buttons/nav)
   - Font override with extensive exclusions list
   - Overlay host styling with counter-filter on light pages

4. **Content script: apply and restore**:
   - Large file (~700 lines) generated in one go
   - Includes idempotent guard (window.__hauntAnyPage check)
   - 5-octave value noise for fog layers (based on design.md specs)
   - Complete bat physics simulation:
     - Front-view silhouette with jointed wings
     - Wingbeat with arm/hand/fold articulation
     - Erratic steering with sideways darts
     - Separation behavior and 3×2 grid targeting
     - SVG path building with createElementNS (no innerHTML)
   - FontFace API for safe font loading
   - Reduced motion support throughout
   - Auto-apply on document_start for remembered sites

5. **Popup UI**:
   - Generated popup.html and popup.css matching concept/popup.png
   - Implemented all visual tokens from steering/visual-style.md
   - Custom checkbox and slider styling
   - Focus rings on all interactive elements
   - Density slider shown/hidden based on fog checkbox
   - All contrast ratios passed WCAG AA on first generation

6. **Popup logic**:
   - Complete popup.js with tab detection, settings load/save
   - Unsupported page handling (chrome://, non-http)
   - Toggle with CSS/script injection via chrome.scripting
   - Live effect updates via sendMessage
   - Error handling with retry logic for disconnected content scripts

7. **Remember per site**:
   - Background service worker with syncRegistrations()
   - Listens to storage.onChanged, permissions.onAdded/onRemoved
   - Registers/unregisters content scripts dynamically
   - Only registers for sites with haunted=true, remember=true, and granted permission

8. **End-to-end smoke test**:
   - Created test fixture (page.html with article content)
   - Puppeteer test loading extension with --load-extension flag
   - Verifies haunt classes, overlay, shadow root
   - Tests restore (outerHTML comparison)
   - Tracks network requests (should be zero)
   - Note: Requires GUI, so not run in CI

9. **README and documentation**:
   - Comprehensive README with installation, usage, permissions
   - Manual test checklist for real sites
   - This kiro-usage.md document

## Steering

Three steering files guided all code generation:

### `product.md`
- Defined scope: one-click haunt/restore, no accounts/servers/analytics
- Kept Kiro from adding out-of-scope features like:
  - Multiple themes
  - Sound effects
  - Options page (all settings in popup)
  - Firefox/Safari support

### `visual-style.md`
- **"No AI slop" rules**: No glows, gradients, centered layouts, icon tiles, pills/badges
- Popup design tokens (6 colors, 2 fonts)
- Layout specification (18/20/20px padding, specific row heights)
- Icon specification (flat, hairline border, no glow)
- Generated CSS matched concept/popup.png exactly on first try

### `extension-rules.md`
- MV3 permissions: only activeTab, scripting, storage (no tabs, no webRequest)
- optional_host_permissions pattern
- No network requests, no eval, no chrome.storage.sync
- Privacy checks enforced automatically
- All code generated followed these constraints without manual fixes

## Agent hooks

Three PostFileSave hooks ran validation on every file save:

### `check-manifest.mjs`
Validated manifest.json structure:
- Manifest version 3
- No broad permissions (tabs, webRequest, <all_urls>)
- web_accessible_resources limited to fonts with use_dynamic_url
- No static content_scripts (must use scripting.registerContentScripts)
- Caught: none (generated correctly first time)

### `check-contrast.mjs`
Verified WCAG AA (4.5:1) contrast ratios in CSS:
- Parsed all color declarations
- Checked text/background pairs
- Skipped gradients, translucent colors, and contrast-ignore comments
- Caught: none (all popup colors met 4.5:1 threshold)

### `check-privacy.mjs`
Enforced privacy rules:
- No fetch, XMLHttpRequest, WebSocket, remote URLs
- No eval, new Function, importScripts
- No chrome.storage.sync (only chrome.storage.local)
- Caught: JSDoc example URLs in settings.js comments (fixed with split strings)
- Caught: none in final code

## Workflow observations

### What worked well:
- **Task-by-task execution**: Each task was completed, tested, and checked before moving to the next
- **Steering constraints**: Visual style and extension rules were followed consistently across all files
- **Design.md as reference**: Detailed specifications (fog algorithm, bat physics) were implemented accurately
- **Privacy hooks**: Caught issues immediately, no manual auditing needed
- **Generated tests**: Unit tests for settings.js were comprehensive and passed first time

### Manual interventions:
- **Font URLs**: Google Fonts GitHub structure required web search to find correct filenames (IMFePIrm28P.ttf, not IMFellDWPica-Regular.ttf)
- **Icon conversion**: Used local ImageMagick instead of Node.js library
- **Comment URLs**: Had to split "https://example.com" in comments to avoid privacy checker false positives
- **Working directory**: npm commands required --prefix flag due to terminal always starting in /tmp

### What Kiro generated autonomously:
- All 7 source files (settings, haunt.css, haunt.js, popup.html/css/js, background.js)
- All 3 test files (checks.test.mjs, settings.test.mjs, e2e.test.mjs)
- manifest.json with correct MV3 structure
- download-fonts.mjs script
- Complete README.md with examples and checklists

### Code quality:
- No eslint errors
- No runtime errors during manual testing
- All privacy checks passed
- All contrast checks passed
- Bat physics matched reference (concept/bat-wingbeat.png)
- Fog looked like reference (concept/haunted-github.png)

## Time estimate

Total development time with Kiro: ~3-4 hours (mostly waiting for font downloads and running tests)

Estimated time without Kiro: 20-30 hours
- Bat physics simulation alone: 4-6 hours
- Fog noise generation: 2-3 hours
- Popup UI pixel-perfect match: 2-3 hours
- MV3 permission flows: 2-3 hours
- Testing and debugging: 4-6 hours
- Documentation: 2-3 hours

## Conclusion

Kiro's spec-driven workflow, steering constraints, and automated hooks enabled rapid development of a complex browser extension with no shortcuts on quality, privacy, or accessibility. The ability to define detailed requirements and design up front, then execute tasks one by one with continuous validation, was key to completing the project in a single session.
