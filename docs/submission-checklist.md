# Kiroween 2026 submission checklist

Deadlines (Pacific Time; Moscow is PT + 11 h in December):

- **1 Dec 2026, 12:00 PT**: Kiro credits request form (Resources tab on Devpost), needs your Kiro user ID.
- **4 Dec 2026, 14:00 PT** (5 Dec, 01:00 Moscow): final submission. Credits must be redeemed by 4 Dec.

## Repository

- [x] Public GitHub repository (`https://github.com/phasepoemshield/haunt-any-page`)
- [x] `LICENSE` (MIT) at the root
- [x] `/.kiro` at the root with specs, steering and hooks; `.kiro` is not in `.gitignore`
- [x] All code written with Kiro, following `.kiro/specs/haunt-any-page/tasks.md`

## Devpost form

- [x] Category: Costume Contest
- [x] Text description in English: see `docs/devpost-submission.md`
- [x] Install instructions or test build link (README "Install (unpacked)" + release zip `haunt-any-page-v0.1.0.zip`)
- [x] Demo video under 3 minutes (`~/Movies/HauntAnyPage-demo/haunt-any-page-demo.mp4`, 1:39, attached to release `v0.1.0` — upload to YouTube as public/unlisted for the Devpost video URL field)
- [x] Write-up in English on how Kiro was used: see `docs/kiro-usage.md` and `docs/devpost-submission.md`

## Demo video outline (about 2 minutes)

1. 0:00 Plain Wikipedia article, click the icon, "Haunt this page": bats, old-book font.
2. 0:30 Popup options: toggle bats and font, candle flicker. Then Weather: Fog on, density, speed and height sliders; fog also works on a normal page.
3. 0:50 Restore: the page is back exactly as it was.
4. 1:05 "Remember this site": reload, it opens haunted.
5. 1:20 A second site (news or GitHub) and an already dark site.
6. 1:35 Kiro: the spec, steering docs, and a hook catching a contrast or privacy mistake on save.
7. 1:55 Permissions: nothing leaves the browser.
