# jukebox 📻

Watch and listen to YouTube together, in sync. Static files only, peer-to-peer over WebRTC, up to 12 people. Peers find each other through public Nostr relays ([Trystero](https://github.com/dmotz/trystero)); only the handshake goes through them, encrypted with the room passphrase. See [spec.md](spec.md).

## Run

```sh
npx serve .        # or: just serve, or: python3 -m http.server
```

Open the printed URL (it must be http(s), not `file://`).

## Test

```sh
node --test        # or: just test. Node 22.15+, nothing to install
```

`tests/` covers the modules without DOM: passphrases, YouTube URLs, the message checks, chat edits, `/giphy` parsing, emoji, `Sync` against a fake player (echo guard, drift, seeks, buffering, Pause for me, autoplay refused), and `shareNewest` over a fake Trystero. The CDN modules are swapped for stand-ins (`tests/fakes/`, and a few gemoji entries). CI runs them on every push (`.github/workflows/test.yml`).

1. **Create a room** and send the link to your friends.
2. They open it, pick a name, and they're in. Whoever's already there is asked whether to share the chat history with them.
3. Refreshing rejoins the room and picks up where the video was.
4. ↑ in an empty chat input edits your last message.
5. `/giphy cats` searches a GIF (bring your own [Giphy API key](https://developers.giphy.com/dashboard/): Create an App → API).
6. The 💬 button in the chat switches to chat mode (chat in the middle, video in the corner); 📺 switches back.
7. **⏸ Pause for me** stops the music for you only; **Rejoin the room** jumps back to where the others are. They see a ⏸ next to your name meanwhile.
8. New messages put a dot on the tab's icon and play a ding while you're away.
9. ⚙️ in the top bar opens the settings: your name, the room's theme (for everyone), the message sound, your Giphy key.

## Code

No build step: plain ES modules, loaded as they are. Trystero and gemoji come from a CDN, pinned by hash in `index.html`'s import map.

Peers and data, no DOM:

- `js/peers.js`: everything peers say to each other: joins the Trystero (Nostr) room, one channel per message type, drops malformed messages, and `shareNewest` for values the room shares (last `sentAt` wins)
- `js/limits.js`: the size limits (names, chat, queue, room) and the checks for the fields every message shares
- `js/session.js`: what survives a refresh, per tab and per room, in `sessionStorage`
- `js/sync.js`: keeps the player in line with the shared `State` (echo guard, drift, seek detection)
- `js/chat.js`: chat message shape, validation, dedup key and edits
- `js/queue.js`: the Up next list's shape and validation
- `js/theme.js`: the list of themes, validation, applying one
- `js/giphy.js`: `/giphy` command parsing, Giphy search with your own key, GIF validation and URLs
- `js/emoji.js`: `:shortcode:` lookup and suggestions (gemoji)
- `js/youtube.js`: IFrame Player API loader and URL parsing
- `js/passphrase.js`: random passphrases from the EFF short wordlist

UI, each module wiring itself to the page and the peers on import:

- `js/main.js`: boots the page (home or room), joins the room, `hello` and who comes and goes, layout toggle
- `js/stage.js`: the player, the link form, Up next and Pause for me
- `js/people.js`: the people list and your `hello`
- `js/chat-log.js`: the chat log: messages, join/leave notices, GIFs
- `js/chat-input.js`: the chat input: sending, editing, emoji and `/giphy` commands
- `js/suggestions.js`: the emoji / command list above the chat input
- `js/giphy-ui.js`: the private `/giphy` preview and the key prompt
- `js/history.js`: asking the room before replaying the chat history to a newcomer
- `js/settings.js`: the settings modal: name, room theme, sound, Giphy key
- `js/notify.js`: new message notifications: favicon dot and ding, with the mute setting
- `js/dom.js`: small DOM helpers (`el`, `button`, errors, status pill)
- `style.css`: layout only; `themes/`: one stylesheet per theme, setting the tokens `style.css` uses (see `themes/README.md`)
- `tests/`: `node --test` tests for the modules above that don't touch the DOM; `tests/fakes/`: Trystero stand-in
- `justfile`: `just test`, `just serve`
- `tickets/`: the backlog, one Markdown file per ticket (see `tickets/clonear.md`)
