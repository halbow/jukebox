---
title: scroll bar is in the way of the chat
priority: low
labels: []
created: 2026-10-02
---

It woudl be nice to have the scroll bar not inside the chat pane, as it's removing space on an already narrow pane

## Done

- The chat log now reaches 20px into the card's right padding, so its scrollbar sits about 4px from the card's border. Messages keep their full width.
- The scrollbar is thin, with no track and a faint, light thumb. Its gutter is always reserved, so the messages don't shift sideways when it first appears.

## QA

- Fill the chat until it scrolls: the scrollbar sits in the card's right margin and the messages don't get narrower.
- The width of the messages doesn't jump when the first scrolling message arrives.
- Chat mode and the narrow (≤ 900px) layout: the scrollbar is still inside the card and isn't clipped by its border.
- macOS overlay scrollbars and classic scrollbars (Windows, or "Always show scroll bars").
