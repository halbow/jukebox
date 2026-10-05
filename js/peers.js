// Everything peers say to each other goes through here.
//
// Peers sharing a passphrase find each other through public Nostr relays (Trystero) and open direct WebRTC
// connections, every peer to every other (mesh). Only the handshake goes through the relays, encrypted with
// the passphrase; the messages below travel peer to peer.
//
// Each message type has its own channel and its own check: a message that fails it is dropped here, so
// handlers only ever see well-formed data. Handlers can be registered before connecting, and sending
// before then does nothing.

import { isChat } from './chat.js'
import { isId, isName, isTime } from './limits.js'
import { isQueue } from './queue.js'
import { isState } from './sync.js'
import { isTheme } from './theme.js'

const APP_ID = 'jukebox-listen-together'

const CHANNELS = {
  hello: isHello, // who you are, see `isHello`: on connect, and again on every change
  state: isState, // the room's player, see sync.js
  chat: isChat, // a message or an edit, see chat.js; also how the history gets replayed to newcomers
  history: isHistoryAnswer, // whether a newcomer gets the chat history, see history.js
  queue: isQueue, // Up next, see queue.js
  theme: isTheme, // the room's theme, see theme.js
}

/** `{ name, joinedAt, pausedLocally, from }`: `from` is the session peer id, which survives a refresh. */
function isHello(msg) {
  return isName(msg?.name) && isTime(msg.joinedAt) && typeof msg.pausedLocally === 'boolean' && isId(msg.from)
}

/** `{ from, share }`: the first answer to "share the chat history with <from>?", settling it for everyone. */
function isHistoryAnswer(msg) {
  return isId(msg?.from) && typeof msg.share === 'boolean'
}

const handlers = {} // message type → (msg, peerId)
const joinHandlers = []
const leaveHandlers = []
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
  actions?.[type].send(msg, peerId && { target: peerId })
}

/**
 * Joins the room. Trystero loads on demand, so the home page doesn't wait for the CDN; the import map in
 * index.html pins it to CDN files checked by hash. Rejects if Trystero can't be loaded.
 * `onUnreachable(peerId)`: a peer is in the room but we can't connect to them (strict networks, no TURN).
 */
export async function connect(passphrase, { onUnreachable }) {
  const { joinRoom } = await import('trystero')
  room = joinRoom({ appId: APP_ID, password: passphrase }, passphrase, {
    onJoinError: ({ error, peerId }) => {
      console.warn('jukebox: join error', error)
      // Trystero keeps retrying: a failed attempt doesn't matter if another one got through.
      if (!(peerId in room.getPeers())) onUnreachable(peerId)
    },
  })
  actions = {}
  for (const [type, isValid] of Object.entries(CHANNELS)) {
    actions[type] = room.makeAction(type)
    actions[type].onMessage = (msg, { peerId }) => isValid(msg) && handlers[type]?.(msg, peerId)
  }
  connectedAt = Date.now()
  room.onPeerJoin = (peerId) => joinHandlers.forEach((handler) => handler(peerId))
  room.onPeerLeave = (peerId) => leaveHandlers.forEach((handler) => handler(peerId))
}

export function leave() {
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
