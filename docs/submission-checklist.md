# Kiroween 2026 submission checklist

Deadlines (Pacific Time; Moscow is PT + 11 h in December):

- **1 Dec 2026, 12:00 PT**: Kiro credits request form (Resources tab on Devpost), needs your Kiro user ID.
- **4 Dec 2026, 14:00 PT** (5 Dec, 01:00 Moscow): final submission. Credits must be redeemed by 4 Dec.

## Repository

- [ ] Public GitHub repository
- [ ] `LICENSE` (MIT) at the root
- [ ] `/.kiro` at the root with specs, steering and hooks; `.kiro` is not in `.gitignore`
- [ ] All code written with Kiro, following `.kiro/specs/haunt-any-page/tasks.md`

## Devpost form

- [ ] Category: Costume Contest
- [ ] Text description in English
- [ ] Install instructions or test build link (README "Install (unpacked)" + a release zip)
- [ ] Demo video under 3 minutes on YouTube (public or unlisted)
- [ ] Write-up in English on how Kiro was used: see `docs/kiro-usage.md`

## Demo video outline (about 2 minutes)

1. 0:00 Plain Wikipedia article, click the icon, "Haunt this page": fog, bats, old-book font.
2. 0:30 Popup options: fog density slider, toggle bats and font, candle flicker.
3. 0:50 Restore: the page is back exactly as it was.
4. 1:05 "Always haunt this site": reload, it opens haunted.
5. 1:20 A second site (news or GitHub) and an already dark site.
6. 1:35 Kiro: the spec, steering docs, and a hook catching a contrast or privacy mistake on save.
7. 1:55 Permissions: nothing leaves the browser.
