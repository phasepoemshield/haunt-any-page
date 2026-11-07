# How Kiro was used

Fill this in while building. Judges read it, so be specific and honest: what you asked Kiro, what it produced, what you changed.

## Spec-driven development

- `.kiro/specs/haunt-any-page/requirements.md`: EARS acceptance criteria for haunt/restore, effect options, remember per site, privacy and accessibility.
- `design.md`: architecture (popup, content script, background service worker), data model, skin technique.
- `tasks.md`: executed task by task in Kiro. Notes per task:
  - Task 1:
  - Task 2:
  - ...

## Steering

- `product.md`: scope and what is out of scope, which kept Kiro from adding features.
- `visual-style.md`: the palette and motion rules, so generated CSS matched the concept.
- `extension-rules.md`: MV3 and privacy rules.
- Examples where steering changed Kiro's output:

## Agent hooks

- `check-manifest`: validates the manifest on save. Caught:
- `check-contrast`: WCAG AA check on CSS save. Caught:
- `check-privacy`: blocks network calls, remote URLs, eval and synced storage. Caught:

## Other (MCP, vibe coding sessions, etc.)

-
