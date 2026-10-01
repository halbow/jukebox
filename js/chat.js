// Tiny room chat. Every peer replays its history to newcomers, so messages are deduplicated by `chatKey`.
//
// type Chat = { type: 'chat', text, name, sentAt, from }

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
    typeof msg.from === 'string'
  )
}

export function createChat(text, { name, from }) {
  return { type: 'chat', text, name, sentAt: Date.now(), from }
}

export function chatKey(msg) {
  return `${msg.from}:${msg.sentAt}`
}
