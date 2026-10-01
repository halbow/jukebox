---
title: Giphy support
priority: low
size: S
labels: []
created: 2026-10-01
---

I want ot be able to search for a gif and send it in the chat

## Decisions

- **Slack-style `/giphy <query>` command only** for v1. No picker grid (separate ticket if missed).
- **Bring your own key.** No backend, so no shared key in the repo. Each user pastes their own Giphy API key, kept in `localStorage` (`jukebox:giphy-key`), never sent to peers.
- The key is only needed to **search**. Viewing GIFs others sent needs no key.
- No GIF button. Without a key, `/giphy cats` shows a private prompt to paste one (with a link to get a beta key). `/giphy key` changes or removes it. Saving checks the key against the API.
- **Private preview** (only you see it, not in the chat log, not saved, not sent): the GIF with **Send / Shuffle / Cancel**, "Powered by GIPHY". Shuffle picks another of the 25 results already fetched. Escape cancels. A new `/giphy` replaces the preview.
- **Message shape:** `{ ...chat, text: <query>, gif: { id, width, height } }`. The query is the caption. Peers get the Giphy **id**, never a URL: each one builds `https://media.giphy.com/media/<id>/200.webp` itself, so nobody can make the room load an arbitrary URL.
- Results filtered with `rating=pg-13`.
- GIF messages can't be edited (↑ skips them).
- `prefers-reduced-motion` shows the still frame. A GIF that no longer loads shows "GIF unavailable". A small "via /giphy" under each GIF advertises the command.
- Privacy: every peer's browser loads the image from Giphy, so Giphy sees their IP. Noted in the spec.

## Getting a beta key

developers.giphy.com → Dashboard → Create an App → **API** (not SDK) → copy the key. Free, ~100 calls/hour.

## Acceptance criteria

- `/giphy cats` with a key shows a private preview; Shuffle changes the GIF; Send posts it for everyone; Cancel / Esc drops it.
- Without a key, `/giphy cats` asks for one; after saving a valid key the search runs. An invalid key shows an error.
- Late joiners and refreshes see GIFs (history replay, `sessionStorage`), without any API call.
- A peer message with a malformed `gif` (bad id, bad sizes) is rejected.
