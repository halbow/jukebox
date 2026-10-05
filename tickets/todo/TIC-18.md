---
title: Add tests
priority: low
labels: []
created: 2026-10-05
---

11. No tests. The pure modules (passphrase, parseVideoId, isNewer / expectedPosition, the validators, emoji, the giphy command parser) could be covered with plain node --test, with no package to install. I'd only do this if you want it; it's new work rather than cleanup.
