---
title: Cross-browser UI tests with Playwright (Chromium, Firefox, WebKit)
priority: medium
size: M
labels: [testing, ci, ui]
created: 2026-10-07
---

## Problem

We keep shipping small UI bugs that only show up in one browser: the scroll doesn't work in Firefox, the
notification bullet is off in Safari, etc. The `node --test` suite only covers logic, so nothing checks how the
page actually renders. Switching to a framework wouldn't help, since these are CSS/layout differences between
browsers.

## What to do

- Add Playwright with three projects: `Desktop Chrome` (Chromium), `Desktop Firefox` and `Desktop Safari` (WebKit).
- Serve `index.html` through Playwright's `webServer` (e.g. `npx serve .`), no build step.
- Write a few browser tests for the screens that have broken before:
  - the chat log / queue actually scroll once they overflow (`scrollHeight > clientHeight` and scrolling moves them),
  - the notification bullet is visible and inside its parent's box,
  - optionally screenshot tests (`toHaveScreenshot`) of the main layout for each theme.
- Add a `just e2e` recipe, and keep `just test` / `node --test` dependency-free.
- Add a CI job for the browser tests next to the existing `node --test` one. Run WebKit on `macos-latest` if
  WebKit on Linux misses Safari bugs.
- Fix the Firefox scroll and Safari bullet bugs as the first tests to go green (probably `min-height: 0` on a
  flex child and a missing `position: relative`).

## Notes

- This adds our first `package.json` / npm dependency (`@playwright/test`), only for the browser tests.
- Playwright's WebKit is close to Safari but isn't Safari: system fonts, emoji and media can still differ. iPhone
  Safari is only emulated.
- Peer-to-peer (Trystero) features may need the fake in `tests/fakes/` or two browser contexts. Keep the first
  tests to layout only.

## Acceptance criteria

- `just e2e` runs the browser tests locally in Chromium, Firefox and WebKit.
- CI runs them on every push / PR and fails on a regression.
- Tests cover the Firefox scroll and Safari notification bullet bugs, and both are fixed.
- README mentions how to run the browser tests.
