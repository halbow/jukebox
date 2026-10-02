# jukebox — spec

A tiny, cosy web app to watch and listen to YouTube videos together, in sync, w2g.tv style.
Local first: static files only, no backend.

## Goal

I'm at home, I open jukebox, create a room, share it with a friend, and we both see and hear
the same YouTube video at the same time. Play / pause / seek / change video are synced.

## Constraints

- **No backend.** Static `index.html` (+ JS/CSS), hostable on GitHub Pages / Netlify or served locally (`npx serve`).
- Must be served over http(s), not `file://`, because the YouTube embed needs a referrer.
- Each browser loads the video directly from YouTube (IFrame Player API). We never restream media.
- Only sync messages travel between peers.

## Architecture

### Connection: passphrase rooms over Trystero (Nostr)

No signaling server of our own. Peers find each other through public Nostr relays with
[Trystero](https://github.com/dmotz/trystero), loaded from a CDN.

```
CREATOR                                 FRIEND
1. "Create room" → passphrase
2. Shares  #room=<passphrase>       ───▶ 3. Opens link, picks a name
4. ✅ Trystero exchanges the handshake over the relays, P2P data channels open
```

- Passphrase: 8 random words from the EFF short wordlist (~83 bits). It's copy/pasted, never typed, so length is free.
- It's both the Trystero room id and its `password`, so relays only see an encrypted handshake.
  Anyone who has the passphrase can join.
- Only the handshake touches the relays. Sync and chat travel peer to peer.
- GIFs are the exception for media: every peer's browser loads them from Giphy, so Giphy sees their IP.
- ICE servers: Trystero's default public STUN. TURN is still out of scope.

### Topology: mesh

- Every peer connects to every other peer. Nobody is the host: the room lives as long as someone is in it.
- Soft cap of 12 people: whoever joined after the first 12 leaves with a "room full" message.

### Survive a refresh

- The passphrase stays in the URL; name, peer id, join time, current `State` and chat are saved per tab in `sessionStorage`.
- A refresh rejoins the same room, restores the video (via `expectedPosition`) and chat, and reconnects automatically.

### Sync protocol

A single message type over the data channel:

```ts
type State = {
  videoId: string
  playing: boolean
  position: number   // seconds, at sentAt
  sentAt: number     // Date.now() of sender
  from: string       // peer id
}
```

- On local player change (play / pause / seek / load), broadcast the `State`.
- On receive, compute the expected position `position + (now - sentAt)/1000` if playing,
  then load / seek / play / pause the local player.
- **Echo guard:** changes applied from remote must not be re-broadcast (flag while applying).
- **Drift:** only seek if `|local - expected| > 1s`.
- A newcomer gets the current state from every peer as soon as they connect, and keeps the newest.
- Conflicts: last `sentAt` wins, ties broken by peer id. Every peer applies the same rule, so all converge.

## UI (v1)

- Home: "Create room" button.
- Name prompt as a modal over the room, so you see it while typing (remembered locally). Peers announce names to each other on connect.
- People list with count and a copy-link button, at the top of the chat card.
- Room: YouTube player; under it the URL input (+ Queue / Play), then a row with Up next and ⏭ Play next on the left (the room's) and ⏸ Pause for me on the right (only yours), then the queue's thumbnails. No "now playing" line: YouTube's own title shows over the player. Connection status in the top bar.
- Room chat: short text messages to agree on the next video. Late joiners get the last 50 messages from everyone, deduplicated, once the room agrees:
  when someone new joins, everyone already in the room with some history sees "<name> just joined. Share the chat history with them?" (Share / Don't share).
  The first answer is broadcast as `{ from: <newcomer's peer id>, share }` on a `history` action and settles it for everyone; the newcomer can't answer for themselves.
  Answers are kept in `sessionStorage` (`sharedWith`), so a refresh doesn't ask again. People who were here before you, and newcomers to a room with no history yet, get it without asking.
  `hello` carries the sender's session peer id as `from`, to recognise people across refreshes.
- Chat emoji, Slack style: typing `:` lists matching shortcodes (arrows + Enter or Tab to pick, Escape to close), and a fully typed `:joy:` turns into 😂, `:D` turns into 😃, and `:p` into 😛. Shortcodes come from GitHub's [gemoji](https://github.com/wooorm/gemoji), loaded from the CDN and pinned by hash.
- Edit your last message: ↑ in an empty chat input loads it back (Escape cancels). The edit is resent with the same `from` and `sentAt` plus an `editedAt`; the newest edit wins, shows as "(edited)", and is what late joiners get.
- `/giphy <search>`, Slack style: a preview only you see, with Send / Shuffle / Cancel (Escape), from 25 results (`rating=pg-13`). Searching needs your own Giphy API key, asked the first time and kept in `localStorage` (`/giphy key` changes or removes it); it never goes to peers, and seeing GIFs needs no key. A GIF message is `{ ...chat, text: <search>, gif: { id, width, height } }`: peers get the Giphy id and build the image URL themselves, never a URL from a peer. GIFs can't be edited, show their still frame under `prefers-reduced-motion`, and "GIF unavailable" once Giphy drops them.
- New message notifications, Slack style: while the tab is hidden or unfocused, a message from someone else puts a dot on the favicon and plays a short ding (synthesized with Web Audio, no sound file). Coming back to the page clears the dot. History replayed when you join doesn't notify. The 🔔 / 🔕 button in the chat header mutes the ding, remembered locally (`jukebox:sound`). Browsers only allow sound after a click or key press on the page.
- Chat mode toggle: the chat takes the room and the video shrinks to a corner, without reloading the player. Remembered locally.
- Pause for me: stops your player without broadcasting. While paused, room `State`s are still received but not applied; "Rejoin the room" (an overlay over the player, so YouTube's own controls can't broadcast a play) applies the latest one at its live position. Picking a video also rejoins. Peers see a ⏸ on your name (a `pausedLocally` flag in `hello`, resent on change). Not kept across a refresh.
- Up next (queue): "+ Queue" next to Play adds the link to a shared list shown under the player as a strip of thumbnails ("added by …", no titles: those would need a request to YouTube). Queuing when nothing is playing plays it right away. ⏭ Play next, or clicking a thumbnail, plays it and takes it out; ✕ removes it. Anyone can do all of it. When a video ends the next one starts by itself: the peers whose player ended advance only if the room is still on that video and it ended within 10s of when expected (so a peer back from a refresh with an old state can't skip the room ahead), and they all pick the same first item. Not under "Pause for me". The list travels like the `State`, whole, last `sentAt` wins: `{ items: [{ id, videoId, addedBy, from }], sentAt, from }`, capped at 50, sent to newcomers and kept in `sessionStorage`. Thumbnails are built from the video id (`i.ytimg.com`), never a URL from a peer.
- Auto-paste: when nothing is playing (no video yet, or the room's video ended), a YouTube link in the clipboard is cued paused on focus.
- A "Join / click to start" button to satisfy the browser autoplay policy.
- Cosy vibe: warm dark theme, jukebox feel.

## Out of scope (v1)

- Reordering the queue
- TURN relay
- Mobile Safari polish

## Known pitfalls

- Autoplay with sound requires a user gesture.
- Ads differ per user, so re-sync when the player enters `PLAYING`.
- Buffering on one peer must not pause everyone.
- Handshakes contain the public IP. They're encrypted with the passphrase on the relays; peers see each other's IP, as expected for P2P.
- jukebox depends on public Nostr relays being up (volunteer-run, no SLA). Trystero connects to several at once.
- Hidden or long-backgrounded tabs get throttled by the browser and may fail to reconnect until they're reloaded.

## Milestones

1. Single-file page: two peers connect via copy/paste, exchange a "ping".
2. YouTube player embedded, with local controls.
3. Sync play / pause / seek / video change between 2 peers (echo guard and drift).
4. Star topology: host plus N guests, with relay.
5. Polish UI and cosy theme.
