---
title: Join with a passphrase link (Trystero signaling) and survive a refresh
priority: medium
size: L
labels: [signaling, webrtc]
created: 2026-10-01
---

Today joining needs a two-way copy/paste (invite link, then an answer code back). WebRTC can't do one-way without something relaying the handshake, so swap the signaling layer for [Trystero](https://github.com/dmotz/trystero) on its default Nostr strategy (public relays, no backend of our own). Video sync and chat stay peer-to-peer.

## What to do

- **Passphrase rooms:** "Create a room" generates a random passphrase (EFF short wordlist, e.g. `plum-otter-river-…`) and a link `…/#room=<passphrase>`. Anyone opening the link, or pasting the passphrase on the home page, joins. No answer code.
- **Passphrase length:** hardcoded to 8 words (~83 bits). It's a copy/paste value, so length costs nothing.
- **Encrypted handshake:** the passphrase is both the Trystero room id and its `password`, so relays can't read the SDP.
- **No host:** every peer connects to every other peer. Conflicts resolve with "last `sentAt` wins", ties broken by peer id. A newcomer gets the current `State`, chat history and names from every peer and keeps the newest. The room lives as long as someone is in it.
- **People limit:** drop the hard limit of 5 (it was arbitrary). Keep a soft cap of 12 as a safety net, since it's a mesh.
- **Survive a refresh:** keep the passphrase in the URL and save the name, current `State` and chat to `sessionStorage`. A refresh rejoins the same room, restores the video and chat, and reconnects automatically.
- Drop the copy/paste flow (`signal.js`); it's in git history if we want it back as a fallback.

## Acceptance criteria

- [ ] Create a room, send the link, the friend picks a name and lands in the room without pasting anything back.
- [ ] Pasting the passphrase on the home page joins the same room.
- [ ] Passphrases are 8 words.
- [ ] Play / pause / seek / change video and chat still sync for 3+ people.
- [ ] Refreshing any page (including the creator's) rejoins the room and restores the video position and chat.
- [ ] The creator leaving doesn't end the room for the others.
- [ ] README and spec updated (relay dependency, what the relays see).
