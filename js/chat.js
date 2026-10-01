// Tiny room chat. Every peer replays its history to newcomers, so messages are deduplicated by `chatKey`.
//
// Editing resends the whole message with the same `from` and `sentAt` (so the same `chatKey`) and a later
// `editedAt`: the newest version wins, and history replays carry it to late joiners.
//
// A `/giphy` message carries a `gif` (see giphy.js) and its search as `text`, shown as the caption.
//
// type Chat = { type: 'chat', text, name, sentAt, from, editedAt?, gif? }

import { isGif } from './giphy.js'

export const MAX_CHAT_LENGTH = 300
export const HISTORY_SIZE = 50 // what peers replay to someone who joins late

export function isChat(msg) {
  return (
    msg?.type === 'chat' &&
    typeof msg.text === 'string' &&
    msg.text.length > 0 &&
    msg.text.length <= MAX_CHAT_LENGTH &&
    typeof msg.name === 'string' &&
    Number.isFinite(msg.sentAt) &&
    typeof msg.from === 'string' &&
    (msg.editedAt === undefined || Number.isFinite(msg.editedAt)) &&
    (msg.gif === undefined || isGif(msg.gif))
  )
}

export function createChat(text, { name, from, gif }) {
  return { type: 'chat', text, name, sentAt: Date.now(), from, ...(gif && { gif }) }
}

export function editChat(msg, text) {
  return { ...msg, text, editedAt: Date.now() }
}

/** Whether `msg` should replace `current`, two versions of the same message. */
export function isNewerEdit(msg, current) {
  return (msg.editedAt ?? 0) > (current.editedAt ?? 0)
}

export function chatKey(msg) {
  return `${msg.from}:${msg.sentAt}`
}

// Readable on the dark cards, and none of them is the green kept for your own messages.
const SENDER_COLORS = ['#f4a259', '#7ec4cf', '#f2a7c3', '#e9c46a', '#b8a1e3', '#f08b78', '#8fb8f0', '#d4a373']

// Same peer, same color, on every screen: hashed from the peer id, which survives a refresh.
export function senderColor(from) {
  let hash = 0
  for (const char of from) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return SENDER_COLORS[hash % SENDER_COLORS.length]
}
