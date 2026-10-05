// Every message peers say to each other: its shape, how it's built, how it's checked, how it's sent and received.
// Nothing outside this file writes a message by hand nor names a channel; peers.js carries them.
//
// Each channel has its own check: a message that fails it is dropped before any handler, so handlers only ever
// see well-formed data. The same checks vet what `session.js` restores after a refresh.
//
// The room shares three values, the player's state, the queue and the theme: every change sends all of it,
// stamped `{ sentAt, from }`, and every peer keeps the newest (see `shareNewest` in peers.js). The rest are
// events: hello, chat, reaction, history.
//
// type Hello = { name, joinedAt, pausedLocally, call /* null, or { muted, camera } in the call */, from }
// type State = { videoId, playing, position /* s, at sentAt */, sentAt /* sender Date.now() */, from }
// type Chat = { type: 'chat', text, name, sentAt, from, editedAt?, gif? }
// type Reaction = { key /* chatKey of the message */, emoji, on, name, sentAt, from }
// type HistoryAnswer = { from /* the newcomer's session peer id */, share }
// type Queue = { items: [{ id, videoId, addedBy /* name */, from /* peer id */ }], sentAt, from }
// type Theme = { id, by /* name, for the chat line */, sentAt, from }
//
// `from` is always the sender's session peer id, which survives a refresh; handlers also get the sender's
// Trystero `peerId`, which doesn't.

import { isGif } from './giphy.js'
import { MAX_CHAT_LENGTH, MAX_QUEUE, isId, isName, isTime, randomId } from './limits.js'
import * as peers from './peers.js'
import { isEmoji } from './reactions.js'
import { THEMES } from './theme.js'
import { isVideoId } from './youtube.js'

const MAX_KEY_LENGTH = 48 // a `chatKey`: an id, a colon and a `Date.now()`

// ---------- hello: who you are, on connect and again on every change ----------

export function createHello({ name, joinedAt, pausedLocally, call, from }) {
  return { name, joinedAt, pausedLocally, call, from }
}

export function isHello(msg) {
  return isName(msg?.name) && isTime(msg.joinedAt) && typeof msg.pausedLocally === 'boolean' && isCall(msg.call) && isId(msg.from)
}

/** `hello.call`: null out of the call, `{ muted, camera }` in it. See call.js. */
export function isCall(value) {
  return value === null || (typeof value?.muted === 'boolean' && typeof value.camera === 'boolean')
}

/** To everyone, or only to `peerId`. */
export const sendHello = (hello, peerId) => peers.send('hello', hello, peerId)
export const onHello = (handler) => peers.on('hello', handler)

// ---------- state: the room's player, see sync.js ----------

export function createState({ videoId, playing, position }, from) {
  return { videoId, playing, position, sentAt: Date.now(), from }
}

export function isState(msg) {
  return isVideoId(msg?.videoId) && typeof msg.playing === 'boolean' && Number.isFinite(msg.position) && isTime(msg.sentAt) && isId(msg.from)
}

export const sendState = (state) => peers.send('state', state)
export const shareState = (sharing) => peers.shareNewest('state', sharing)

// ---------- chat: a message or an edit, see chat.js; also how the history gets replayed to newcomers ----------

/** A `/giphy` message carries a `gif` (see giphy.js) and its search as `text`, shown as the caption. */
export function createChat(text, { name, from, gif }) {
  return { type: 'chat', text, name, sentAt: Date.now(), from, ...(gif && { gif }) }
}

/** The whole message again, same `from` and `sentAt` (so the same `chatKey`), and a later `editedAt`. */
export function editChat(msg, text) {
  return { ...msg, text, editedAt: Date.now() }
}

export function isChat(msg) {
  return (
    msg?.type === 'chat' &&
    typeof msg.text === 'string' &&
    msg.text.length > 0 &&
    msg.text.length <= MAX_CHAT_LENGTH &&
    isName(msg.name) &&
    isTime(msg.sentAt) &&
    isId(msg.from) &&
    (msg.editedAt === undefined || isTime(msg.editedAt)) &&
    (msg.gif === undefined || isGif(msg.gif))
  )
}

export const sendChat = (msg, peerId) => peers.send('chat', msg, peerId)
export const onChat = (handler) => peers.on('chat', handler)

// ---------- reaction: an emoji on a message, or taken off, see reactions.js; replayed with the history ----------

export function createReaction(key, emoji, on, { name, from }) {
  return { key, emoji, on, name, sentAt: Date.now(), from }
}

export function isReaction(msg) {
  return (
    typeof msg?.key === 'string' &&
    msg.key.length > 0 &&
    msg.key.length <= MAX_KEY_LENGTH &&
    isEmoji(msg.emoji) &&
    typeof msg.on === 'boolean' &&
    isName(msg.name) &&
    isTime(msg.sentAt) &&
    isId(msg.from)
  )
}

export const sendReaction = (reaction, peerId) => peers.send('reaction', reaction, peerId)
export const onReaction = (handler) => peers.on('reaction', handler)

// ---------- history: the first answer to "share the chat history with <from>?", settling it for everyone ----------

export function createHistoryAnswer(from, share) {
  return { from, share }
}

export function isHistoryAnswer(msg) {
  return isId(msg?.from) && typeof msg.share === 'boolean'
}

export const sendHistoryAnswer = (answer) => peers.send('history', answer)
export const onHistoryAnswer = (handler) => peers.on('history', handler)

// ---------- queue: Up next, see queue.js ----------

export function createQueueItem(videoId, { name, from }) {
  return { id: randomId(), videoId, addedBy: name, from }
}

export function createQueue(items, from) {
  return { items, sentAt: Date.now(), from }
}

function isQueueItem(item) {
  return isId(item?.id) && isVideoId(item.videoId) && isName(item.addedBy) && isId(item.from)
}

export function isQueue(msg) {
  return Array.isArray(msg?.items) && msg.items.length <= MAX_QUEUE && msg.items.every(isQueueItem) && isTime(msg.sentAt) && isId(msg.from)
}

export const sendQueue = (queue) => peers.send('queue', queue)
export const shareQueue = (sharing) => peers.shareNewest('queue', sharing)

// ---------- theme: the room's theme, see theme.js ----------

export function createTheme(id, { name, from }) {
  return { id, by: name, sentAt: Date.now(), from }
}

export function isTheme(msg) {
  return Object.hasOwn(THEMES, msg?.id) && (msg.by === undefined || isName(msg.by)) && isTime(msg.sentAt) && isId(msg.from)
}

export const sendTheme = (theme) => peers.send('theme', theme)
export const shareTheme = (sharing) => peers.shareNewest('theme', sharing)

// ---------- the room ----------

export const CHANNELS = {
  hello: isHello,
  state: isState,
  chat: isChat,
  reaction: isReaction,
  history: isHistoryAnswer,
  queue: isQueue,
  theme: isTheme,
}

/** Joins the room with every channel above. See `connect` in peers.js. */
export function connect(passphrase, { onUnreachable }) {
  return peers.connect(passphrase, { channels: CHANNELS, onUnreachable })
}
