// The emoji picker for reactions, just below the message it's for: a few favourites, and a search through
// the `:shortcode:` names (see emoji.js). Only you see it. The chat log puts it back under its message on
// every render (see `reactionPickerFor`), so it's one element that lives across renders.

import { chatKey } from './chat.js'
import { actionsRow, button, el, hint } from './dom.js'
import { suggest } from './emoji.js'

const FAVOURITES = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '😮', '🙏']

const box = el('div', { className: 'reaction-picker' })
let open = null // { key, pick } while the picker is open

/** The picker, if it's open for the message `key`, for the chat log to place under it. */
export function reactionPickerFor(key) {
  return open?.key === key ? box : null
}

/** Opens the picker for `msg` (a chat message), or closes it if it's already open there. `pick(emoji)` gets the chosen one. */
export function toggleReactionPicker(msg, pick) {
  const key = chatKey(msg)
  if (open?.key === key) return closeReactionPicker()
  open = { key, pick }
  const search = el('input', { type: 'text', placeholder: 'Search emoji, e.g. tada', autocomplete: 'off', spellcheck: false })
  const results = el('div', { className: 'reaction-choices' })
  search.addEventListener('input', () => {
    const query = search.value.trim().replace(/^:|:$/g, '')
    const emoji = query ? suggest(query).map(({ name, emoji }) => ({ emoji, title: `:${name}:` })) : []
    results.replaceChildren(...(query && !emoji.length ? [hint('No emoji found')] : emoji.map(choice)))
  })
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeReactionPicker()
    if (e.key === 'Enter') {
      e.preventDefault()
      results.querySelector('button')?.click()
    }
  })
  box.replaceChildren(
    el('div', { className: 'reaction-choices' }, ...FAVOURITES.map((emoji) => choice({ emoji }))),
    actionsRow(search, button('Cancel', closeReactionPicker)),
    results,
  )
  // once the chat log has placed it
  queueMicrotask(() => {
    box.scrollIntoView({ block: 'nearest' })
    search.focus()
  })
}

export function closeReactionPicker() {
  open = null
  box.remove()
  box.replaceChildren()
}

function choice({ emoji, title }) {
  const node = button(emoji, () => {
    const { pick } = open
    closeReactionPicker()
    pick(emoji)
  }, 'icon-btn reaction-choice')
  if (title) node.title = title
  return node
}
