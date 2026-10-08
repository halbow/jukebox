// The `/chess` card in the chat log: Join while there's room for a player, Watch once two people joined.
// The Lichess side and who's playing are in chess.js.

import { CLOCK, gameUrl } from './chess.js'
import { el } from './dom.js'

/** The card for `chess`; `players` from `playersOf`, `me` your session peer id, `onJoin` records your click. */
export function chessCard({ id }, players, me, onJoin) {
  const playing = players.some((p) => p.from === me)
  const full = players.length === 2
  const about = el('span', { textContent: `♟ Chess ${CLOCK.limit / 60}+${CLOCK.increment} on Lichess · ${caption(players, me)}` })
  const label = playing ? 'Open' : full ? 'Watch' : 'Join'
  const link = el('a', { className: `btn small${playing || full ? '' : ' primary'}`, href: gameUrl(id), target: '_blank', rel: 'noopener', textContent: label })
  if (!playing && !full) link.addEventListener('click', onJoin) // the link still opens the game
  return el('div', { className: 'chess-card' }, about, link)
}

function caption(players, me) {
  const names = players.map((p) => (p.from === me ? 'You' : p.name || 'Friend'))
  if (names.length === 2) return `${names[0]} vs ${names[1]}`
  if (names.length === 1) return `${names[0]} ${names[0] === 'You' ? 'are' : 'is'} waiting for an opponent`
  return 'colours at random'
}
