---
title: Add a small message in the chat when someone joins or leaves
priority: low
size: S
labels: [chat]
created: 2026-10-02
---

Add a greyed/faded out message in the chat, with the time, when someone joins or leaves the room.

## Done

- "HH:MM: <name> joined" / "HH:MM: <name> left" line, faded and italic, sorted in with the messages.
- Local only: never replayed to newcomers nor saved, gone after a refresh.
- No "joined" for people already in the room when you came, unless they left and came back (e.g. a refresh).
- A peer who drops before sending their hello (name) shows nothing.

## QA

- Two tabs in the same room: open the second → the first sees "HH:MM: <name> joined".
- Close the second → the first sees "HH:MM: <name> left".
- Refresh the second → the first sees "left" then "joined".
- The second tab doesn't see "joined" for the people already there.
