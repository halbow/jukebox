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

### Connection: WebRTC with copy/paste signaling

No signaling server. Users exchange connection codes by hand (WhatsApp, Slack, …).

```
HOST                                   GUEST
1. "Create room" → OFFER
2. Shares link  #offer=<code>  ──────▶ 3. Opens link → ANSWER code shown
5. Pastes answer ◀───────────────────── 4. Sends answer code back
6. ✅ P2P data channel open
```

- Non-trickle ICE: wait for `iceGatheringState === 'complete'` before showing a code.
- Codes: `JSON → deflate (CompressionStream) → base64url`.
- Offer goes in the URL hash, so the guest only clicks. Only the answer needs to be pasted.
- ICE servers: public STUN only.
  ```js
  [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }]
  ```
- TURN is out of scope for v1. It's the fallback if strict NAT (mobile data, corporate) blocks the connection.

### Topology: star

- The host keeps one `RTCPeerConnection` per guest and repeats the offer/answer exchange per guest.
- The host is the source of truth and relays every event to all other guests.
- Target: 2–8 people.
- If the host leaves, the room ends.

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
- A new guest gets the current state from the host as soon as the channel opens.
- Conflicts: last `sentAt` wins (the host arbitrates).

## UI (v1)

- Home: "Create room" button.
- Host view: offer link plus copy button, "paste answer" field, connected peer count.
- Guest view: their answer code plus copy button, "waiting for host…" status.
- Room: YouTube player, URL input to change video, connection status.
- A "Join / click to start" button to satisfy the browser autoplay policy.
- Cosy vibe: warm dark theme, jukebox feel.

## Out of scope (v1)

- Queue / playlist
- Chat
- TURN relay
- Persistent rooms / reconnect without a new exchange
- Automatic signaling (Trystero / Nostr), a possible v2 that swaps only the signaling layer
- Mobile Safari polish

## Known pitfalls

- Autoplay with sound requires a user gesture.
- Ads differ per user, so re-sync when the player enters `PLAYING`.
- Buffering on one peer must not pause everyone.
- Offer and answer codes contain the public IP. That's expected for P2P.

## Milestones

1. Single-file page: two peers connect via copy/paste, exchange a "ping".
2. YouTube player embedded, with local controls.
3. Sync play / pause / seek / video change between 2 peers (echo guard and drift).
4. Star topology: host plus N guests, with relay.
5. Polish UI and cosy theme.
