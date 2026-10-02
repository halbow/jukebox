// The room's theme, shared like the queue: picking one sends `{ id, by, sentAt, from }` and the newest `sentAt`
// wins (ties broken by peer id), so everyone in the room ends up on the same one.
//
// A theme is a stylesheet in themes/ that sets the tokens on `:root[data-theme='<id>']`, see themes/README.md.

export const THEMES = { cosy: 'Cosy', cyberpunk: 'Cyberpunk' } // id → name, in the settings' order
export const DEFAULT_THEME = { id: 'cosy', sentAt: 0, from: '' }

const MAX_NAME_LENGTH = 24

export function isTheme(msg) {
  return (
    Object.hasOwn(THEMES, msg?.id) &&
    (msg.by === undefined || (typeof msg.by === 'string' && msg.by.length <= MAX_NAME_LENGTH)) && // who picked it, for the chat line
    Number.isFinite(msg.sentAt) &&
    typeof msg.from === 'string'
  )
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = id
}
