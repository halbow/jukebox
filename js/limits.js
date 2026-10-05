// How big things may get, and the checks for the fields every peer message shares. The UI uses the same
// limits (input `maxLength`s are set from here), but peers are never trusted to have kept to them.

export const MAX_PEOPLE = 12 // you included. Soft cap: in a mesh every extra person costs everyone a connection.
export const MAX_NAME_LENGTH = 24
export const MAX_CHAT_LENGTH = 300
export const HISTORY_SIZE = 50 // chat messages replayed to someone who joins late
export const MAX_QUEUE = 50
export const MAX_REACTIONS = 1000 // kept per room, removed ones included: about 20 per message in the history
const MAX_ID_LENGTH = 16

/** A peer's session id, or a queue item's. */
export function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

/** A display name as sent by a peer. Empty is allowed: the UI shows a stand-in. */
export function isName(value) {
  return typeof value === 'string' && value.length <= MAX_NAME_LENGTH
}

/** A `Date.now()`, from whichever clock sent it. */
export function isTime(value) {
  return Number.isFinite(value)
}

/** Trim, collapse whitespace and cap a display name. Empty means "no name". */
export function cleanName(name) {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : ''
}
