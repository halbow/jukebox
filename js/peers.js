// How peers reach each other: the room, its message channels, and the call's media. What they say, and the
// checks it goes through, is protocol.js.
//
// Peers sharing a passphrase find each other through public Nostr relays (Trystero) and open direct WebRTC
// connections, every peer to every other (mesh). Only the handshake goes through the relays, encrypted with
// the passphrase; the messages travel peer to peer.
//
// Each message type has its own channel and its own check: a message that fails it is dropped here, so
// handlers only ever see well-formed data. Handlers can be registered before connecting, and sending
// before then does nothing.

import { debug } from './debug.js'

const APP_ID = 'jukebox-listen-together'

const handlers = {} // message type → (msg, peerId)
const joinHandlers = []
const leaveHandlers = []
let streamHandler = null
let trackHandler = null
let room = null
let actions = null // message type → Trystero action

/** When we joined the mesh, Infinity before. */
export let connectedAt = Infinity

/** Handles one message type: `handler(msg, peerId)`, with `peerId` the sender's Trystero id. */
export function on(type, handler) {
  handlers[type] = handler
}

/** `handler(peerId)` once a peer is connected, in registration order. */
export function onPeerJoin(handler) {
  joinHandlers.push(handler)
}

export function onPeerLeave(handler) {
  leaveHandlers.push(handler)
}

/** Sends to everyone, or only to `peerId`. */
export function send(type, msg, peerId) {
  if (!actions) return
  debug(`▲ ${type} to ${peerId ?? 'everyone'}`, msg)
  actions[type].send(msg, peerId && { target: peerId })
}

// ---------- media, for the call ----------
// Streams travel over the same connections as the messages. Trystero renegotiates them as tracks come and go.

/** `handler(stream, peerId)` when a peer starts sending us their stream. */
export function onPeerStream(handler) {
  streamHandler = handler
}

/** `handler(track, stream, peerId)` when a peer adds a track to the stream they send us. */
export function onPeerTrack(handler) {
  trackHandler = handler
}

export function addStream(stream, peerId) {
  debug(`▲ stream to ${peerId}`, stream)
  room?.addStream(stream, { target: peerId })
}

export function removeStream(stream, peerId) {
  debug(`▲ stream removed for ${peerId}`)
  room?.removeStream(stream, { target: peerId })
}

/** Adds `track` to `stream`, already sent to `peerId`. */
export function addTrack(track, stream, peerId) {
  debug(`▲ track to ${peerId}`, track)
  room?.addTrack(track, stream, { target: peerId })
}

export function removeTrack(track, peerId) {
  debug(`▲ track removed for ${peerId}`, track)
  room?.removeTrack(track, { target: peerId })
}

/**
 * Joins the room, with one channel per message type: `channels` is type → check, see protocol.js.
 * Trystero loads on demand, so the home page doesn't wait for the CDN; the import map in index.html pins it
 * to CDN files checked by hash. Rejects if Trystero can't be loaded.
 * `onUnreachable(peerId)`: a peer is in the room but we can't connect to them (strict networks, no TURN).
 */
export async function connect(passphrase, { channels, onUnreachable }) {
  const { joinRoom } = await import('trystero')
  room = joinRoom({ appId: APP_ID, password: passphrase }, passphrase, {
    onJoinError: ({ error, peerId }) => {
      console.warn('jukebox: join error', error)
      debug(`✖ join error with ${peerId}`, error)
      // Trystero keeps retrying: a failed attempt doesn't matter if another one got through.
      if (!(peerId in room.getPeers())) onUnreachable(peerId)
    },
  })
  actions = {}
  for (const [type, isValid] of Object.entries(channels)) {
    actions[type] = room.makeAction(type)
    actions[type].onMessage = (msg, { peerId }) => {
      const valid = isValid(msg)
      debug(`▼ ${type} from ${peerId}${valid ? '' : ' (malformed, dropped)'}`, msg)
      if (valid) handlers[type]?.(msg, peerId)
    }
  }
  connectedAt = Date.now()
  debug('joined the room')
  room.onPeerJoin = (peerId) => {
    debug(`● ${peerId} connected`)
    joinHandlers.forEach((handler) => handler(peerId))
  }
  room.onPeerLeave = (peerId) => {
    debug(`○ ${peerId} left`)
    leaveHandlers.forEach((handler) => handler(peerId))
  }
  room.onPeerStream = (stream, peerId) => {
    debug(`▼ stream from ${peerId}`, stream)
    streamHandler?.(stream, peerId)
  }
  room.onPeerTrack = (track, stream, peerId) => {
    debug(`▼ track from ${peerId}`, track)
    trackHandler?.(track, stream, peerId)
  }
}

export function leave() {
  if (room) debug('left the room')
  room?.leave()
  room = actions = null
}

/** No host to arbitrate: every peer keeps the last `sentAt`, ties broken by peer id, so all converge. */
export function isNewer(a, b) {
  return a.sentAt > b.sentAt || (a.sentAt === b.sentAt && a.from > b.from)
}

/**
 * A value the whole room shares, like the player's state or the queue: every change sends all of it, as
 * `{ ...value, sentAt, from }`, and every peer keeps the newest. Newcomers get ours as soon as they connect,
 * and a peer that sends an older one (e.g. restored after a refresh while the room moved on) gets ours back.
 *
 * `current()` is ours: null, or `sentAt: 0`, while there's nothing to share. `accept(msg)` takes a newer one.
 */
export function shareNewest(type, { current, accept }) {
  onPeerJoin((peerId) => {
    if (current()?.sentAt) send(type, current(), peerId)
  })
  on(type, (msg, peerId) => {
    const mine = current()
    if (!mine || isNewer(msg, mine)) return accept(msg)
    if (isNewer(mine, msg)) send(type, mine, peerId)
  })
}
