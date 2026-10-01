---
title: Tracklist
priority: low
size: L
labels: []
created: 2026-10-01
---

Allow several video for later and haev a samll playlist

## Decisions

- **Shared queue**, one list for the room, synced whole like the `State` (last `sentAt` wins).
- **+ Queue** next to Play (Enter still plays). If nothing is playing, Queue plays right away.
- **Layout** under the player: link bar (+ Queue / Play), then "Up next · ⏭ Play next" on the left and "⏸ Pause for me" on the right, room-wide vs only you. The "Now playing" line is gone. Clicking a thumbnail plays it now; ✕ removes it. Anyone can do it.
- **Auto-advance** when a video ends. Guard: only if the room is still on the ended video and it ended within 10s of the expected position, so a peer back from a refresh can't skip the room ahead. Not under "Pause for me".
- **Thumbnail + "added by"**, no title: the link only has the id, a title would need a request to YouTube (oEmbed).
- No reordering for now. No chat message on queue.
- Auto-paste only when nothing is playing (no video, or the room's video ended).

## Acceptance criteria

- Queue two videos while one plays: both peers see the strip in the same order.
- Next / thumbnail click plays it for everyone and removes it; ✕ removes it for everyone.
- When the video ends, the next one starts once (not skipping two), for everyone.
- A refresh keeps the queue; a late joiner gets it.
- Auto-paste doesn't replace a playing video.
