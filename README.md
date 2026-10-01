# jukebox 📻

Watch and listen to YouTube together, in sync. Static files only, peer-to-peer over WebRTC, up to 5 people (host + 4 friends). See [spec.md](spec.md).

## Run

```sh
npx serve .        # or: python3 -m http.server
```

Open the printed URL (it must be http(s), not `file://`).

1. **Create a room**, copy the invite link and send it to a friend.
2. Your friend opens it and sends back their answer code.
3. Paste it into **Let them in**. A fresh link appears for the next friend.

## Code

- `js/signal.js`: WebRTC offer/answer with copy/paste codes (deflate + base64url, non-trickle ICE)
- `js/sync.js`: keeps the player in line with the shared `State` (echo guard, drift, seek detection)
- `js/youtube.js`: IFrame Player API loader and URL parsing
- `js/chat.js`: chat message shape and validation (the host stamps names and relays)
- `js/main.js`: UI, host star relay / arbitration, guest flow, chat
