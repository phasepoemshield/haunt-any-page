# Haunt Any Page

One click turns any website into a haunted version of itself: a dark candle-lit palette, drifting fog, flying bats and an old-book font. Click again and the page is back to normal.

Built for **Kiroween 2026** (category: Costume Contest) with [Kiro](https://kiro.dev).

> Status: in development. The behavior is specified in [`.kiro/specs/haunt-any-page`](.kiro/specs/haunt-any-page/requirements.md); the look is shown in [`concept/haunt-any-page.html`](concept/haunt-any-page.html).

## Features

- **Haunt / Restore** with one button. Restore removes every trace from the page.
- **Effects**: fog (with a density slider), bats, old-book font, candle flicker.
- **Remembers per site**: tick "Always haunt this site" and it opens haunted every time.
- **Comfortable**: respects "reduce motion", the popup meets WCAG AA contrast and works with the keyboard.

## Privacy and permissions

Nothing leaves your browser. No network requests, no analytics, no remote code or fonts.

| Permission | Why |
|---|---|
| `activeTab` | Change only the tab you clicked the extension on. |
| `scripting` | Add and remove the haunted style sheet on that tab. |
| `storage` | Remember your choices per site, on this device only. |
| optional host access | Asked per site, only if you tick "Always haunt this site". |

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and choose the repository folder.
4. Pin "Haunt Any Page", open any website and click the icon.

## Development

No build step. Requires Node.js 20+ only for the checks and tests.

```sh
npm test        # unit tests
npm run check   # manifest, contrast and privacy checks (also run by Kiro hooks on save)
```

Kiro project files:

- `.kiro/specs/haunt-any-page/`: requirements, design and task list
- `.kiro/steering/`: product scope, visual style, extension and privacy rules
- `.kiro/hooks/`: on-save checks for the manifest, CSS contrast and privacy

## Credits

- Font: IM Fell DW Pica by Igino Marini, SIL Open Font License 1.1.

## License

[MIT](LICENSE)
