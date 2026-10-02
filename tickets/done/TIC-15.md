---
title: Different themes
priority: low
size: M
labels: []
created: 2026-10-02
---

Let's add different theme for the app.

Let's design the html/css so that teh team apply cleanly from a separate container/folder.
Let's start with another theme
- electro/cyberpunk theme

## Done

- Themes live in `themes/`, one stylesheet each. `style.css` now only does layout: every color, the font, the corner radius and the page backdrop come from tokens set by the theme. `themes/README.md` lists the tokens and the steps to add a theme.
- Two themes: **Cosy**, the current look and the default, and **Cyberpunk**: neon cyan and magenta on a night-city grid, monospace font, sharp corners, glowing buttons, faint CRT scanlines and a flickering logo (the flicker is off under reduced motion).
- Chat name colors and the favicon's unread dot follow the theme too.
- Settings has a new "Room theme" picker. The theme belongs to the room: changing it changes it for everyone. It's shared like the queue (newest wins), sent to people who join, and kept through a refresh.
- Everyone sees "<name> switched the theme to …" in the chat when it changes, but not for the theme a newcomer gets on arrival.
- The home page stays Cosy.

## QA

- Two people in a room: one picks Cyberpunk in the settings. Both switch at once and both see the chat line.
- Someone joins after the switch: they arrive in Cyberpunk with no chat line.
- Refresh: the room stays in Cyberpunk. Switch back to Cosy from the other person's tab: everyone goes back.
- Cosy looks exactly as before (home, room, settings, name prompt, emoji list, /giphy preview, queue strip, "ended" page).
- Cyberpunk: check the same screens for readability, especially muted text, the history-share prompt and the queue numbers.
- Chat mode and the narrow (≤ 900px) layout in both themes.
- The unread dot on the favicon is magenta in Cyberpunk and terracotta in Cosy.
- With reduced motion turned on, the logo doesn't flicker.
