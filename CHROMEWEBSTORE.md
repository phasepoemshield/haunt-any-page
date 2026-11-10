# Chrome Web Store Listing — Haunt Any Page

> Last Updated: 2026-11-10

## Store Listing

**Extension Name** [REQUIRED]
Haunt Any Page

**Short Description** [REQUIRED]
One click turns any website into a haunted version of itself with a candle-lit palette, bats, old-book font, and drifting fog.

**Detailed Description** [REQUIRED]
Haunt Any Page transforms any webpage into a moody, candle-lit reading experience with a single click—and restores the page to its exact original state whenever you want.

Key features:
Warm candle-lit dark palette that automatically adapts to both light and dark websites while keeping images and videos clear
Flying bats that dart and glide across the screen without blocking clicks or links
Old-book typography for article text and headings while leaving code blocks, inputs, and icons untouched
Subtle candle-flicker vignette around the edges of the page
Independent Weather layer with drifting fog and adjustable density, speed, and height sliders—works on any page, haunted or not
Per-site memory so your favorite websites can open haunted automatically on every visit
Respects your system Reduced Motion preference by disabling animations and keeping effects static

How to use:
1. Open any webpage and click the Haunt Any Page icon in your toolbar.
2. Click "Haunt this page" to apply the haunted look, or toggle individual effects (Bats, Old-book font, Candle flicker).
3. Under Weather, turn on Fog and adjust Density, Speed, and Height to your liking.
4. Check "Remember this site" if you want your settings applied automatically whenever you return.
5. Click "Restore the page" at any time to return the webpage to normal immediately.

Privacy and permissions:
Haunt Any Page runs entirely on your device. It never collects, reads, or transmits your browsing history or page content, makes zero network requests, and stores your per-site preferences only in local browser storage on your computer.

Support and feedback:
Report issues or share feedback at https://github.com/phasepoemshield/haunt-any-page/issues

**Category** [REQUIRED]
Fun

**Single Purpose** [REQUIRED]
Applies a customizable haunted visual theme and atmospheric fog overlay to web pages on demand.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `assets/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ✅ Ready | `concept/haunted-github.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ✅ Ready | `concept/popup.png` |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Allows applying or removing the haunted visual theme on the currently open tab when the user clicks the extension icon. |
| `scripting` | permissions | Injects the visual theme stylesheet and overlay script into the active tab on user action, and registers the script for specific sites the user chooses to remember. |
| `storage` | permissions | Saves the user's visual effect toggles and fog slider preferences locally on their device (`chrome.storage.local`). |
| `https://*/*`, `http://*/*` | optional_host_permissions | Requested only for a single site origin when the user explicitly checks "Remember this site", allowing the extension to apply their saved theme automatically when they revisit that specific site. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/phasepoemshield/haunt-any-page#privacy

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
phasepoemshield

**Contact Email** [REQUIRED]
katoru781@gmail.com

**Support URL / Email** [RECOMMENDED]
https://github.com/phasepoemshield/haunt-any-page/issues

**Homepage URL** [RECOMMENDED]
https://github.com/phasepoemshield/haunt-any-page

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-11-10 | Initial Kiroween 2026 release: one-click haunt/restore, bats, old-book font, candle flicker, independent Weather fog with density/speed/height controls, and per-site memory. | Draft |

## Review Notes

### Known Issues / Limitations
- Browser-internal pages (`chrome://`, `chrome-extension://`) and the Chrome Web Store cannot be scripted by extensions; the popup displays "This page can't be haunted." on those pages.
