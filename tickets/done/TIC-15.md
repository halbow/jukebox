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
- Four themes, all music-related:
  - **Cosy**: the current look, the default.
  - **Cassette**: an '80s radio-cassette boombox. Black plastic and chrome, speaker grilles on both sides, an FM dial with its red needle in the top bar, silver piano-key buttons that go down when pressed, a cassette in the deck's window when nothing plays, and a tape reel instead of the vinyl.
  - **Festival**: the main stage at sunset, the sun going down behind the stage, wristbands for the people list.
  - **Concert hall**: classical music. Red velvet curtains drawn to the sides, staves of sheet music in the air, Didot italics and small caps like a concert programme, a treble clef after the name, gilded frames around the screen and cards, a ❦ ornament, and a piano keyboard along the top of the chat.
- Studio, Jazz club, Hi-Fi, Electro (the reworked Cyberpunk), Rave and Punk were tried and dropped.
- A theme can be light too: native controls, scrollbars, input and button backgrounds now come from the theme too (`--scheme`, `--field`, `--raised`, `--hover`).
- Chat name colors and the favicon's unread dot follow the theme too.
- Settings has a new "Room theme" picker. The theme belongs to the room: changing it changes it for everyone. It's shared like the queue (newest wins), sent to people who join, and kept through a refresh.
- Everyone sees "<name> switched the theme to …" in the chat when it changes, but not for the theme a newcomer gets on arrival.
- The home page stays Cosy.

## QA

- Two people in a room: one picks Concert hall in the settings. Both switch at once and both see the chat line.
- Someone joins after the switch: they arrive in Concert hall with no chat line.
- Refresh: the room stays in Concert hall. Switch back to Cosy from the other person's tab: everyone goes back.
- Cosy looks exactly as before (home, room, settings, name prompt, emoji list, /giphy preview, queue strip, "ended" page).
- Every theme: check the same screens for readability, especially muted text, the history-share prompt, the queue numbers and the emoji list.
- Cassette: the speaker grilles stay behind the cards on narrow windows, the FM dial hides under 820px, and the cassette in the window still looks right in chat mode (small video).
- Concert hall: the ❦ sits on the double rule under the people, and the keyboard doesn't cover the "In the room" title.
- Fonts fall back to system ones on Windows/Linux (Didot, Baskerville, DIN Alternate are macOS): check they still look right.
- Chat mode and the narrow (≤ 900px) layout in every theme.
- The unread dot on the favicon uses the theme's second accent (red in Cassette, terracotta in Cosy).
