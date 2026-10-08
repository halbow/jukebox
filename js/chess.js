// `/chess`: an anonymous Lichess game for the room. Lichess's open challenge needs no account nor key:
// the first two people to open its URL play, colours drawn at random; anyone after them watches.
// Lichess doesn't tell anyone who joined, so the room keeps track: every Join click is a `ChessJoin` (see
// protocol.js), and the first two people to click are the players.
//
// Peers only ever get the Lichess game id, and build the URL from it, so nobody can make the room open
// an arbitrary URL. type Chess = { id }

const API = 'https://lichess.org/api/challenge/open'
export const CLOCK = { limit: 300, increment: 3 } // s; 5+3 blitz
const MAX_JOINS = 200 // kept per room: two per game counts, and a few more for the late clickers

export function isChess(chess) {
  return typeof chess?.id === 'string' && /^[A-Za-z0-9]{8}$/.test(chess.id)
}

export const gameUrl = (id) => `https://lichess.org/${id}`

/** `/chess` → true, anything else → false. */
export function isChessCommand(text) {
  return /^\/chess$/i.test(text.trim())
}

/** Typing `/`, `/ch`… (no space yet) offers the command, like `:` offers emoji. */
export function completesChessCommand(text) {
  return /^\/\w*$/.test(text) && '/chess'.startsWith(text.toLowerCase())
}

/** What peers that don't know `/chess` yet show instead of the Join button. */
export const chessText = (id) => `♟ Chess, ${CLOCK.limit / 60}+${CLOCK.increment}: ${gameUrl(id)}`

/** Resolves with a new game's `Chess`. */
export async function createGame() {
  const body = new URLSearchParams({
    rated: false,
    'clock.limit': CLOCK.limit,
    'clock.increment': CLOCK.increment,
    name: 'Jukebox',
  })
  let res
  try {
    res = await fetch(API, { method: 'POST', body })
  } catch {
    throw new Error("Couldn't reach Lichess. Check your connection.")
  }
  if (res.status === 429) throw new Error('Too many games created, try again in a minute.')
  if (!res.ok) throw new Error(`Lichess is having trouble (${res.status}).`)
  const chess = { id: (await res.json()).id }
  if (!isChess(chess)) throw new Error('Lichess sent back something unexpected.')
  return chess
}

const byTime = (a, b) => a.sentAt - b.sentAt || (a.from < b.from ? -1 : 1) // same order on every peer

/** `joins` with `join` in, or null if that person already joined that game: their first click counts. */
export function addChessJoin(joins, join) {
  if (joins.some((j) => j.key === join.key && j.from === join.from && j.sentAt <= join.sentAt)) return null
  const next = [...joins.filter((j) => !(j.key === join.key && j.from === join.from)), join]
  return next.length <= MAX_JOINS ? next : next.sort(byTime).slice(-MAX_JOINS)
}

/** The players of the game posted as message `key`: the first two people who clicked Join, [{ name, from }]. */
export function playersOf(joins, key) {
  return joins
    .filter((j) => j.key === key)
    .sort(byTime)
    .slice(0, 2)
    .map(({ name, from }) => ({ name, from }))
}
