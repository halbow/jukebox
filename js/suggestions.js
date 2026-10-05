// The list that floats above the chat input, Slack style: emoji while a `:shortcode` is typed, the
// `/giphy` command while a `/` is. What to suggest is the chat input's call; this is only the list.
//
// type Suggestion = { icon, label, detail?, insert /* replaces the text from `start` to the caret */ }

import { el } from './dom.js'

export function suggestionList(input, list, { onPick }) {
  let open = null // { start, suggestions, selected } while the list shows

  function close() {
    open = null
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
  }

  function render() {
    list.replaceChildren(
      ...open.suggestions.map(({ icon, label, detail }, i) => {
        const li = el('li', { role: 'option', ariaSelected: String(i === open.selected) }, el('span', { textContent: icon }), label)
        if (detail) li.append(el('small', { textContent: detail }))
        // mousedown, not click: keeps the focus (and the caret) in the input
        li.addEventListener('mousedown', (e) => {
          e.preventDefault()
          pick(i)
        })
        return li
      }),
    )
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    list.children[open.selected]?.scrollIntoView({ block: 'nearest' })
  }

  function pick(i) {
    input.setRangeText(open.suggestions[i].insert, open.start, input.selectionStart, 'end')
    close()
    onPick()
  }

  input.addEventListener('blur', close)

  return {
    get isOpen() {
      return open !== null
    },

    /** Shows these suggestions for the text typed from `start`, or closes the list if there are none. */
    show(start, suggestions) {
      if (!suggestions.length) return close()
      open = { start, suggestions, selected: 0 }
      render()
    },

    close,

    /** The arrows, Enter, Tab and Escape, while the list shows. Returns whether it took the key. */
    keydown(e) {
      if (!open) return false
      const count = open.suggestions.length
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        open.selected = (open.selected + (e.key === 'ArrowDown' ? 1 : -1) + count) % count
        render()
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        pick(open.selected) // pick it, don't send the message
      } else if (e.key === 'Escape') {
        close()
      } else {
        return false
      }
      e.preventDefault()
      return true
    },
  }
}
