# Themes

The room's look, picked in the settings and shared with everyone in the room. `style.css` only lays things out:
every color, the font, the corner radius and the page backdrop come from the tokens a theme sets.

## Adding a theme

1. Copy `cosy.css` to `<id>.css` and scope it to `:root[data-theme='<id>']` (`cosy.css` alone uses `:root`: it's the default and the fallback).
2. Set every token. Anything you leave out falls back to Cosy's.
3. Optionally, add touches only your theme has under `[data-theme='<id>'] …`, like the scanlines in `cyberpunk.css`.
4. Link it in `index.html`, after `cosy.css`, and add `<id>: '<Name>'` to `THEMES` in `js/theme.js`.

## Tokens

| Token | What it colors |
| --- | --- |
| `--font`, `--radius` | Body font, card corners |
| `--backdrop` | The page background (gradients over `--bg`) |
| `--bg` | The darkest color: page, scrims behind modals and overlays (tinted) |
| `--surface`, `--surface-deep` | Popovers, the empty screen, the vinyl's grooves |
| `--card`, `--card-shadow` | Cards (semi-transparent, blurred) |
| `--line` | Borders |
| `--text`, `--muted` | Text, secondary text |
| `--accent`, `--accent-2` | Highlights, focus, the primary button's gradient, the favicon dot (`--accent-2`) |
| `--on-accent` | Text on the primary button |
| `--ok`, `--err` | Connected / your own name, errors |
| `--sender-0` … `--sender-7` | Other people's names in the chat |
