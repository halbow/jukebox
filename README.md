# jukebox 📻

Watch and listen to YouTube together, in sync. Static files only, peer-to-peer over WebRTC, up to 12 people. Peers find each other through public Nostr relays ([Trystero](https://github.com/dmotz/trystero)); only the handshake goes through them, encrypted with the room passphrase. See [spec.md](spec.md).

## Run

```sh
npx serve .        # or: python3 -m http.server
```

Open the printed URL (it must be http(s), not `file://`).

1. **Create a room** and send the link to your friends.
2. They open it, pick a name, and they're in.
3. Refreshing rejoins the room and picks up where the video was.
4. ↑ in an empty chat input edits your last message.
5. The 💬 button in the chat switches to chat mode (chat in the middle, video in the corner); 📺 switches back.
6. **⏸ Pause for me** stops the music for you only; **Rejoin the room** jumps back to where the others are. They see a ⏸ next to your name meanwhile.

## Code

- `js/room.js`: joins a Trystero (Nostr) room, with the passphrase as room id and password
- `js/passphrase.js`: random passphrases from the EFF short wordlist
- `js/sync.js`: keeps the player in line with the shared `State` (echo guard, drift, seek detection)
- `js/youtube.js`: IFrame Player API loader and URL parsing
- `js/chat.js`: chat message shape, validation, dedup key and edits
- `js/emoji.js`: `:shortcode:` lookup and suggestions for the chat (gemoji)
- `js/main.js`: UI, mesh sync (last `sentAt` wins), names, chat, `sessionStorage` persistence
