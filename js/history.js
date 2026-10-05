// Chat history for newcomers. Someone new only gets it once someone in the room says yes: everyone with some
// history is asked, and the first answer (`{ from: <newcomer's session peer id>, share }`) settles it for all.
// People who were here before us, or come back after a refresh, get it without asking.
// Answers are kept in `session.sharedWith`, so a refresh doesn't ask again.

import { $, actionsRow, button, el, hint } from './dom.js'
import { on, onPeerLeave, send } from './peers.js'
import { people } from './people.js'
import { save, session } from './session.js'

let asks = [] // newcomers waiting for someone here to answer: [{ peerId, from, name }]

on('history', ({ from, share }, peerId) => {
  if (people.get(peerId)?.from === from) return // nobody answers for themselves
  if (from in session.sharedWith) return // already settled here
  settleHistory(from, share)
})

onPeerLeave((peerId) => {
  asks = asks.filter((ask) => ask.peerId !== peerId)
  renderAsks()
})

/** Someone's `hello` just arrived for the first time: share the history, or ask the room first. */
export function offerHistory(peerId, { from, name, joinedAt }) {
  if (!(from in session.sharedWith)) {
    if (session.chat.length && joinedAt > session.joinedAt) {
      asks.push({ peerId, from, name })
      return renderAsks()
    }
    session.sharedWith[from] = true // nothing to hide: they were here first, or there's no history yet
    save()
  }
  if (session.sharedWith[from]) sendHistory(peerId)
}

function answerHistory(from, share) {
  settleHistory(from, share)
  send('history', { from, share })
}

function settleHistory(from, share) {
  session.sharedWith[from] = share
  save()
  asks = asks.filter((ask) => ask.from !== from)
  renderAsks()
  if (!share) return
  // Every peer replays what it has: `chatKey` deduplicates.
  for (const [peerId, person] of people) if (person.from === from) sendHistory(peerId)
}

function sendHistory(peerId) {
  for (const msg of session.chat) send('chat', msg, peerId)
}

function renderAsks() {
  $('history-asks').replaceChildren(
    ...asks.map(({ from, name }) =>
      el(
        'div',
        { className: 'history-ask' },
        hint(`${name} just joined. Share the chat history with them?`),
        actionsRow(button('Share', () => answerHistory(from, true), 'btn small primary'), button("Don't share", () => answerHistory(from, false))),
      ),
    ),
  )
}
