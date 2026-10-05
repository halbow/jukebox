// What survives a refresh, per tab and per room, in `sessionStorage`:
//
// { peerId, name, joinedAt, state, chat, reactions, queue, theme, sharedWith }
//
// Each module keeps its part of the room right in `session` (the chat log is `session.chat`, the queue
// `session.queue`…) and calls `save()` after changing it.

import { isChat } from './chat.js'
import { cleanName, isId, isTime, randomId } from './limits.js'
import { EMPTY_QUEUE, isQueue } from './queue.js'
import { isReaction } from './reactions.js'
import { isState } from './sync.js'
import { DEFAULT_THEME, isTheme } from './theme.js'

/** The current room's, once it's open. */
export let session = null
let storageKey = null

export function openSession(passphrase) {
  storageKey = `jukebox:room:${passphrase}`
  session = load(storageKey)
  return session
}

export function save() {
  if (session) sessionStorage.setItem(storageKey, JSON.stringify(session))
}

function load(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key))
    if (isId(saved?.peerId) && isTime(saved.joinedAt)) {
      return {
        peerId: saved.peerId,
        name: cleanName(saved.name),
        joinedAt: saved.joinedAt,
        state: isState(saved.state) ? saved.state : null,
        chat: Array.isArray(saved.chat) ? saved.chat.filter(isChat) : [],
        reactions: Array.isArray(saved.reactions) ? saved.reactions.filter(isReaction) : [],
        queue: isQueue(saved.queue) ? saved.queue : EMPTY_QUEUE,
        theme: isTheme(saved.theme) ? saved.theme : DEFAULT_THEME,
        sharedWith: isSharedWith(saved.sharedWith) ? saved.sharedWith : {},
      }
    }
  } catch {
    // corrupted or missing: start fresh
  }
  return { peerId: randomId(), name: '', joinedAt: Date.now(), state: null, chat: [], reactions: [], queue: EMPTY_QUEUE, theme: DEFAULT_THEME, sharedWith: {} }
}

// session peer id → whether they get the chat history replayed
function isSharedWith(value) {
  return value !== null && typeof value === 'object' && Object.values(value).every((v) => typeof v === 'boolean')
}
