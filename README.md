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

`tests/` covers the modules without DOM: passphrases, YouTube URLs, the message checks, chat edits, reactions, `/giphy` parsing, `/chess` (parsing, game ids, who's playing, the Lichess call over a fake `fetch`), emoji, `Sync` against a fake player (echo guard, drift, seeks, buffering, Pause for me, autoplay refused), the call's rules (who gets your stream, video quality), and `shareNewest` and the media hooks over a fake Trystero. The CDN modules are swapped for stand-ins (`tests/fakes/`, and a few gemoji entries). CI runs them on every push (`.github/workflows/test.yml`).

1. **Create a room** and send the link to your friends.
2. They open it, pick a name, and they're in. Whoever's already there is asked whether to share the chat history with them.
3. Refreshing rejoins the room and picks up where the video was.
4. ↑ in an empty chat input edits your last message.
5. 🙂 on a message reacts to it with an emoji; click a reaction to add or take off yours.
6. `/giphy cats` searches a GIF (bring your own [Giphy API key](https://developers.giphy.com/dashboard/): Create an App → API).
7. `/chess` starts an anonymous [Lichess](https://lichess.org) game: the first two to click **Join** play, colours at random; once they're in, the button turns into **Watch**.
8. The 💬 button in the chat switches to chat mode (chat in the middle, video in the corner); 📺 switches back.
9. **⏸ Pause for me** stops the music for you only; **Rejoin the room** jumps back to where the others are. They see a ⏸ next to your name meanwhile.
10. **📞**, next to "In the room", starts a call: the others are asked to join, and the music pauses for whoever's in it. Mute, show your video, hang up to get back to the music.
11. New messages put a dot on the tab's icon and play a ding while you're away.
12. ⚙️ in the top bar opens the settings: your name, the room's theme (for everyone), chat mode, the message sound, the debug log, your Giphy key.

## Code

No build step: plain ES modules, loaded as they are. Trystero and gemoji come from a CDN, pinned by hash in `index.html`'s import map.

Peers and data, no DOM:

- `js/protocol.js`: every message peers say to each other: its shape, its builder, its check, and `sendX` / `onX` to send and receive it. Nothing else writes a message or names a channel
- `js/peers.js`: how peers reach each other: joins the Trystero (Nostr) room, one channel per message type, drops malformed messages, `shareNewest` for values the room shares (last `sentAt` wins), and the call's streams
- `js/limits.js`: the size limits (names, chat, queue, room) and the checks for the fields every message shares
- `js/session.js`: what survives a refresh, per tab and per room, in `sessionStorage`
- `js/sync.js`: keeps the player in line with the shared `State` (echo guard, drift, seek detection)
- `js/chat.js`: chat message shape, validation, dedup key and edits
- `js/reactions.js`: emoji reactions' shape, validation, merging (newest per message, emoji and person) and pills
- `js/queue.js`: the Up next list's shape and validation
- `js/theme.js`: the list of themes, validation, applying one
- `js/giphy.js`: `/giphy` command parsing, Giphy search with your own key, GIF validation and URLs
- `js/chess.js`: `/chess` command parsing, creating a Lichess open challenge, who's playing (the first two to click Join), game id validation and URL
- `js/emoji.js`: `:shortcode:` lookup and suggestions (gemoji)
- `js/call.js`: the call's `hello` field, who gets your stream, your video's quality by the call's size
- `js/youtube.js`: IFrame Player API loader and URL parsing
- `js/passphrase.js`: random passphrases from the EFF short wordlist

UI, each module wiring itself to the page and the peers on import:

- `js/main.js`: boots the page (home or room), joins the room, `hello` and who comes and goes
- `js/stage.js`: the player, the link form, Up next and Pause for me
- `js/people.js`: the people list and your `hello`
- `js/chat-log.js`: the chat log: messages, reactions, join/leave notices, GIFs, chess games
- `js/chat-input.js`: the chat input: sending, editing, emoji, `/giphy` and `/chess` commands
- `js/suggestions.js`: the emoji / command list above the chat input
- `js/reaction-picker.js`: the emoji picker for reactions, just below the message
- `js/chess-ui.js`: the `/chess` card in the chat log, Join, then Watch once two people joined
- `js/giphy-ui.js`: the private `/giphy` preview and the key prompt
- `js/call-ui.js`: the 📞 button, the call screen (tiles, mute, camera, hang up) and the "is calling" prompt
- `js/history.js`: asking the room before replaying the chat history to a newcomer
- `js/settings.js`: the settings modal: name, room theme, chat mode, sound, debug log, Giphy key
- `js/debug.js`: the debug log, in the console: peer messages, joins and leaves, sync decisions
- `js/notify.js`: new message notifications: favicon dot and ding, with the mute setting
- `js/dom.js`: small DOM helpers (`el`, `button`, errors, status pill)
- `style.css`: layout only; `themes/`: one stylesheet per theme, setting the tokens `style.css` uses (see `themes/README.md`)
- `tests/`: `node --test` tests for the modules above that don't touch the DOM; `tests/fakes/`: Trystero stand-in
- `justfile`: `just test`, `just serve`
- `tickets/`: the backlog, one Markdown file per ticket (see `tickets/clonear.md`)
