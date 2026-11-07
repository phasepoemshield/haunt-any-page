---
inclusion: always
---

# Extension rules (Manifest V3, privacy)

## Permissions

- Install-time permissions are exactly `activeTab`, `scripting`, `storage`. Nothing else (no `tabs`, no `<all_urls>`, no `webRequest`).
- `host_permissions` stays empty. Per-site access for "Always haunt this site" comes from `optional_host_permissions` (`https://*/*`, `http://*/*`) requested with `chrome.permissions.request` for one origin, inside a click handler.
- No static `content_scripts` in the manifest. Inject with `chrome.scripting` from the popup, or register remembered sites with `chrome.scripting.registerContentScripts`.
- `web_accessible_resources` exposes only `assets/fonts/*` with `"use_dynamic_url": true`.

## No data leaves the browser

- No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, remote URLs, CDN fonts, analytics or error reporting.
- No `eval`, `new Function`, remote or dynamic code.
- Use `chrome.storage.local` only, never `chrome.storage.sync`. Store only site origins and setting values; never page content or full URLs.
- `scripts/check-privacy.mjs` enforces this on save. If a line is a false positive (for example the SVG namespace), add a `privacy-ignore` comment and explain why.

## Code style

- Plain JavaScript ES modules, no build step, no dependencies at runtime. `"type": "module"` for the service worker.
- `async/await` for all `chrome.*` calls, wrapped in `try/catch` in the popup.
- The content script must be idempotent (safe to inject twice) and must fully undo itself on restore.
- Never write page-controlled strings into `innerHTML`. Build DOM nodes with `createElement`/`createElementNS`.
- Keep the overlay inside a closed shadow root so page CSS cannot break it and our CSS cannot leak into the page.
- Scope every rule in `src/content/haunt.css` under `html.haunt-on`.

## Before marking a task done

Run `npm test` and `npm run check`. Both must pass.
