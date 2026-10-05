// Who's in the room: the people at the top of the chat card, and the `hello` that tells the others who you are.

import { myCall } from './call-ui.js'
import { $, el, setStatus } from './dom.js'
import { MAX_PEOPLE } from './limits.js'
import { session } from './session.js'
import { sync } from './stage.js'

/** Everyone else: Trystero peer id → { name, joinedAt, pausedLocally, call, from }, from their `hello`. */
export const people = new Map()

/** What the others need to know about you, see `isHello`. */
export function hello() {
  return { name: session.name, joinedAt: session.joinedAt, pausedLocally: sync.pausedLocally, call: myCall(), from: session.peerId }
}

/** Whoever arrived after the first MAX_PEOPLE leaves. Older members stay, even after a refresh. */
export function isOverCap() {
  const before = [...people.values()].filter((p) => p.joinedAt < session.joinedAt).length
  return before >= MAX_PEOPLE
}

export function renderPeople() {
  const others = [...people.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  $('people').replaceChildren(
    ...[{ name: 'You', pausedLocally: sync.pausedLocally, call: myCall() }, ...others].map(({ name, pausedLocally, call }) => {
      const li = el('li', { textContent: name })
      if (call) {
        li.classList.add('in-call')
        li.title = 'In the call'
      } else if (pausedLocally) {
        li.classList.add('paused')
        li.title = 'Paused for themselves, not listening right now'
      }
      return li
    }),
  )
  const count = others.length + 1
  $('people-count').textContent = `${count}/${MAX_PEOPLE}`
  setStatus(others.length ? `In the room · ${count}` : 'Waiting for friends…', others.length ? 'ok' : '')
}
