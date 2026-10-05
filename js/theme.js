// The room's theme, shared like the queue: picking one sends `{ id, by, sentAt, from }` and the newest `sentAt`
// wins (ties broken by peer id), so everyone in the room ends up on the same one.
//
// A theme is a stylesheet in themes/ that sets the tokens on `:root[data-theme='<id>']`, see themes/README.md.

import { isId, isName, isTime } from './limits.js'

// id → name, in the settings' order
export const THEMES = {
  cosy: 'Cosy',
  cassette: 'Cassette',
  festival: 'Festival',
  concert: 'Concert hall',
  tavern: 'Tavern',
}
export const DEFAULT_THEME = { id: 'cosy', sentAt: 0, from: '' }

export function isTheme(msg) {
  return (
    Object.hasOwn(THEMES, msg?.id) &&
    (msg.by === undefined || isName(msg.by)) && // who picked it, for the chat line
    isTime(msg.sentAt) &&
    isId(msg.from)
  )
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = id
}
