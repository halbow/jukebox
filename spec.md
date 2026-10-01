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
- Invite card: room link plus copy button. People list with count.
- Room: YouTube player, URL input to change video, connection status.
- Room chat: short text messages to agree on the next video. Late joiners get the last 50 messages from everyone, deduplicated.
- A "Join / click to start" button to satisfy the browser autoplay policy.
- Cosy vibe: warm dark theme, jukebox feel.

## Out of scope (v1)

- Queue / playlist
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
