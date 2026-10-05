---
title: Call mode, voice and video between the people in the room
priority: medium
size: M
labels: [call]
created: 2026-10-05
---

## What

A single 📞 button to talk with the others, peer to peer over the connections the room already has
(Trystero media, nothing new to load).

- 📞 next to the chat's Send button. Clicking it asks for the mic and drops you in the call screen: it takes the
  player's place, the chat stays on the side.
- In the call screen: 🎤 mute / unmute, 📷 show / hide your video, **Hang up**. You join with the mic on and
  the camera off. Hiding your video stops the camera (its light goes off), it doesn't send black frames.
- When someone starts a call, the others get "📞 **<name> is calling** · Join / Not now" in the chat, with
  the ding if they're away. Coming into a room while a call is going on asks the same. "Not now" only hides
  it: the button reads **📞 Join** while the call goes on, and the next call asks again.
- Joining pauses the music for you (Pause for me); hanging up rejoins the room, unless you had paused it
  yourself before joining.
- The call ends by itself when the last one hangs up: it only exists as the `call` field in everyone's `hello`.
- The more people in the call, the lower your video: 640×360 at 30 fps for two, down to 160×90 at 10 fps.
- The people list shows a 📞 next to those in the call.

## How

- `hello` gets `call: null | { muted, camera }`, resent on every change like `pausedLocally`.
- You send your stream to everyone whose `hello` says they're in the call, and stop when it says they left.
- Not kept across a refresh: you come back out of the call.

## Acceptance criteria

- Two tabs: one calls, the other is prompted, joins, both hear each other and the music is paused for both.
- Camera on and off shows and hides the tile's video on the other side; mute shows on the tile.
- Hanging up rejoins the music at the room's position.
- Someone who refuses the mic gets an error and stays out of the call.
- Tests: `hello` with `call`, the video quality per count, who to send the stream to, and the media hooks in `peers.js`.
- Update `spec.md` and the README.
