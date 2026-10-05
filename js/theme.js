// The room's theme, shared like the queue: picking one sends `{ id, by, sentAt, from }` and the newest `sentAt`
// wins (ties broken by peer id), so everyone in the room ends up on the same one.
//
// A theme is a stylesheet in themes/ that sets the tokens on `:root[data-theme='<id>']`, see themes/README.md.

// id → name, in the settings' order
export const THEMES = {
  cosy: 'Cosy',
  cassette: 'Cassette',
  festival: 'Festival',
  concert: 'Concert hall',
  tavern: 'Tavern',
}
export const DEFAULT_THEME = { id: 'cosy', sentAt: 0, from: '' }

export function applyTheme(id) {
  document.documentElement.dataset.theme = id
}
