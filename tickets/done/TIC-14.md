---
title: Better view for the text being typed
priority: low
labels: []
created: 2026-10-02
---

When you type a message, you only see the alst few words.
It would be nice to have a betetr view somehow

## Done

- The chat input is now a box that grows as the message wraps, up to 5 lines, then scrolls. You can see the whole message instead of only its last few words.
- Messages are still one line: Enter sends (or picks the highlighted emoji), and pasted line breaks become spaces.
- The box goes back to one line once a message is sent, an edit is cancelled, or a `/giphy` search runs. It refits when the chat changes width (window resize, chat mode).
- ↑ to edit loads a long message with the end in view, where the caret is.

## QA

- Type a long message: the input grows line by line, stops at 5 lines, then scrolls with a faint thin scrollbar. The Send button stays at the bottom.
- Enter sends, and the input shrinks back to one line.
- `:jo` + Enter picks 😂 without sending. `/giphy cats` + Enter still searches.
- Paste multi-line text: it lands on one line with spaces, and the caret stays right after the pasted text.
- ↑ in an empty input loads a long last message with its end in view. Escape clears it and the box shrinks.
- Resize the window and toggle chat mode while a long message is typed: the height follows the new wrapping.
- With an IME (e.g. Japanese), Enter confirms the composition and doesn't send.
