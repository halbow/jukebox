---
title: Add tests
priority: low
size: S
labels: [tests]
created: 2026-10-05
---

11. No tests. The pure modules (passphrase, parseVideoId, isNewer / expectedPosition, the validators, emoji, the giphy command parser) could be covered with plain node --test, with no package to install. I'd only do this if you want it; it's new work rather than cleanup.

## Done

- `tests/`, one `*.test.js` per module: passphrase, youtube (`parseVideoId`, `isVideoId`), limits, sync (`isState`, `expectedPosition`), peers (`isNewer`), chat, queue, theme, giphy (command parsing, `isGif`), emoji.
- emoji runs against a small stand-in for gemoji (a `registerHooks` resolve hook), so tests work offline.
- `Sync` against a fake player on mocked clocks: loads at the live position, echo guard, drift (1s), the room pausing / changing video, local play / pause / seek broadcast, buffering ignored and caught up after, `load`, Pause for me and rejoin, autoplay refused.
- `shareNewest` and `connect` over a fake Trystero (`tests/fakes/trystero.js`): newcomers get ours, newer accepted, older answered with ours to that peer only, ties by peer id, malformed messages dropped.
- Plain `node --test` (Node 22.15+), nothing to install; `just test` runs it. README has a "Test" section.
- CI: `.github/workflows/test.yml` runs the tests on every push and pull request.

## QA

- `node --test` (or `just test`) at the root → 74 tests pass.
- Push → the "test" workflow is green on GitHub.
- Break something (e.g. flip `a.from > b.from` in `isNewer`, or make `#guarded()` return false in sync.js) → a test fails.
