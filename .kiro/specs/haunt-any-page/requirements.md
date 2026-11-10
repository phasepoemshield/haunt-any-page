# Requirements: Haunt Any Page

## Introduction

Haunt Any Page is a Manifest V3 browser extension (Chrome, Edge, other Chromium browsers). With one click it turns the open website into a haunted version of itself: a dark candle-lit palette, flying bats, an old-book font and an optional candle flicker. A second click restores the page exactly as it was. Weather (fog) is a separate, optional layer that works on any page, haunted or not. The extension remembers the choice per site and never sends any data out of the browser.

Visual reference: `concept/haunt-any-page.html` (open it in a browser). Hackathon: Kiroween 2026, category Costume Contest.

## Glossary

- **Skin**: the haunted look applied to a page (palette, font, overlay).
- **Overlay**: one fixed, click-through layer on top of the page that holds bats and the candle vignette.
- **Site**: a page origin, for example `https://en.wikipedia.org`.
- **Settings**: `{ haunted, bats, font, flicker, remember }` for one site.
- **Weather**: `{ fog, fogDensity, fogSpeed, fogHeight }` for one site, stored under `weather` and independent of the skin.

## Requirement 1: Haunt and restore with one click

**User story:** As a visitor of any website, I want one button that haunts the page and a second click that restores it, so that I can dress up a page and undo it instantly.

### Acceptance criteria

1. WHEN the user opens the popup on an `http` or `https` page THE SYSTEM SHALL show a primary button labelled "Haunt this page" and the status "<origin> looks normal."
2. WHEN the user clicks "Haunt this page" THE SYSTEM SHALL apply the skin to the active tab within 300 ms, change the label to "Restore the page" and the status to "<origin> is haunted."
3. WHEN the user clicks "Restore the page" THE SYSTEM SHALL remove every class, style element, overlay and font override the extension added, so that the page DOM is the same as before haunting.
4. WHEN the skin is applied twice to the same page THE SYSTEM SHALL keep exactly one overlay and one style sheet (idempotent).
5. WHEN the popup is opened on a page the extension cannot script (for example `chrome://`, the Chrome Web Store, a PDF viewer) THE SYSTEM SHALL disable the controls and show "This page can't be haunted".
6. THE SYSTEM SHALL keep the page interactive while haunted: links, forms, scrolling and text selection SHALL work, and the overlay SHALL never receive pointer events.

## Requirement 2: Effect options

**User story:** As a user, I want to choose which spooky effects are on, so that the page stays readable and fits my taste.

### Acceptance criteria

1. THE SYSTEM SHALL offer three effect checkboxes: Bats (default on), Old-book font (default on), Candle flicker (default off).
2. THE SYSTEM SHALL offer a separate Weather section (see Requirement 2a); fog is not an effect of the skin.
3. WHEN the user changes any option while the page is haunted THE SYSTEM SHALL update the page live without reloading it.
4. WHEN the user changes an option while the page is not haunted THE SYSTEM SHALL store it and use it at the next haunt.
5. WHEN Old-book font is on THE SYSTEM SHALL use the bundled IM Fell DW Pica font for body text and headings and SHALL NOT change the font of code, `pre`, form fields or icon fonts.
6. (Moved to Requirement 2a.)
7. WHEN Bats is on THE SYSTEM SHALL fly six bats with the classic front-view bat silhouette and jointed, visibly flapping wings, driven by a flight simulation (lift on each downstroke, erratic darts); the bats SHALL spread across the whole window and SHALL NOT fly as one group.
8. WHEN the page already has a dark background (relative luminance of the body background below 0.2) THE SYSTEM SHALL skip the color inversion and apply only the tint, bats and font.

## Requirement 2a: Weather

**User story:** As a user, I want fog that I switch on separately from the skin, so that I can have atmosphere on a normal page or on a haunted one.

### Acceptance criteria

1. THE SYSTEM SHALL offer a Weather section with a Fog checkbox (default off) and, only while Fog is checked, sliders Density (default 55), Speed (default 50) and Height (default 60), each from 0 to 100.
2. THE SYSTEM SHALL let Fog work whether or not the page is haunted; restoring the page SHALL NOT remove fog, and unchecking Fog SHALL NOT restore the page.
3. WHEN Fog is on THE SYSTEM SHALL show layered, drifting wisps that are denser near the bottom of the window, with clear gaps between them, not a uniform grey veil and not a single blob. Layers SHALL have no hard edge and the tile SHALL repeat without a seam.
4. WHEN the user moves a slider THE SYSTEM SHALL update the fog live without rebuilding it.
5. THE SYSTEM SHALL choose pale fog over dark or haunted pages and slate-grey fog over normal light pages, and SHALL re-check the page tone after the document and its style sheets have loaded.
6. THE SYSTEM SHALL store weather settings per site under `weather`, apart from the skin settings.
7. WHEN reduce motion is on THE SYSTEM SHALL show the fog without animation.

## Requirement 3: Remember per site

**User story:** As a user, I want my favorite sites to open haunted automatically, so that I do not have to click every time.

### Acceptance criteria

1. THE SYSTEM SHALL save the settings for the current site in `chrome.storage.local` whenever they change.
2. WHEN the user opens the popup on a site with saved settings THE SYSTEM SHALL show those settings.
3. THE SYSTEM SHALL offer a "Remember this site" checkbox that covers both the haunted skin and Weather.
4. WHEN the user checks "Remember this site" THE SYSTEM SHALL request the optional host permission for that site only; IF the user denies it THEN THE SYSTEM SHALL uncheck the box and keep working with one-click haunting.
5. WHEN a remembered site with granted permission is loaded or reloaded and its saved state is haunted or its fog is on THE SYSTEM SHALL apply the skin and the fog at `document_start`, before the first paint where possible.
6. WHEN the user unchecks "Remember this site" THE SYSTEM SHALL stop restoring it automatically and remove the host permission for it.

## Requirement 4: Privacy and permissions

**User story:** As a user, I want an extension that is easy to trust, so that I can install it without worry.

### Acceptance criteria

1. THE SYSTEM SHALL request only `activeTab`, `scripting` and `storage` at install time, and `optional_host_permissions` per site at runtime.
2. THE SYSTEM SHALL NOT make any network request, load remote code, fonts or images, use analytics, or use `chrome.storage.sync`.
3. THE SYSTEM SHALL bundle every asset (font, icons, bat shapes) inside the extension package.
4. THE SYSTEM SHALL NOT read, store or transmit page content; the only stored data is the settings per site origin.

## Requirement 5: Accessibility and comfort

**User story:** As a user sensitive to motion or low contrast, I want the effect to stay comfortable, so that I can still read the page.

### Acceptance criteria

1. WHEN the operating system has "reduce motion" enabled THE SYSTEM SHALL show fog without animation, hide bats and disable the flicker.
2. THE popup SHALL meet WCAG AA text contrast (4.5:1) and be fully usable with the keyboard, with a visible focus ring.
3. THE candle flicker SHALL dim the page by at most 30% and SHALL NOT flash more than 3 times per second.
4. THE popup controls SHALL have accessible names; the primary button SHALL expose its state with `aria-pressed`.
