---
title: Signed chat messages, so only the author can edit
priority: low
size: L
labels: [chat, security]
created: 2026-10-01
---

Follow-up to TIC-8 (edit last message).

## Problem

A message's `from` is the sender's session peer id, which is self-reported and visible to everyone in the room.
Anyone with the passphrase can send `{ from: theirId, sentAt: theirMessage.sentAt, editedAt: later, text }` and
rewrite someone else's message. Same hole for new messages: anyone can post as someone else.

Checking the Trystero sender isn't enough: its peer id changes on every load, and late joiners get the history
replayed by whoever is online, not by the author.

## What to do

- Each tab generates a P-256 signing key (WebCrypto) once and keeps it in `sessionStorage` with the peer id, so it survives a refresh.
- Every message carries a random `id` (replaces the `from:sentAt` key), `from` = the public key, and `sig` over `{ id, text, name, sentAt, editedAt }`.
- Peers drop any message whose signature doesn't verify against `from`.
- An edit is the same `id` with new text, a later `editedAt` and a new signature. It's accepted only if its `from` matches the original's.
- ↑ again in edit mode steps further back through your own messages (Slack style), so any of your messages can be edited.

## Notes

- About 200 extra bytes per message, fine for 12 people and 50 messages of history.
- Verifying is async, so receiving a message becomes async.
- A new tab is a new identity: no editing messages sent from another tab.
- Unsigned messages saved in `sessionStorage` get dropped once.

## Acceptance criteria

- A forged edit or message (wrong key, or a `from` that doesn't match the original's) is ignored by every peer, including in history replays.
- You can edit any of your own messages from this tab, before and after a refresh.
- Update `spec.md` (chat message shape) and the README.
