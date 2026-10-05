// Slack-style emoji reactions on chat messages. A reaction is one person's emoji on one message, on or off:
// every click sends a newer one, and every peer keeps the newest per (message, emoji, person), so all converge.
// Removed ones are kept, off, so an older "on" replayed with the history can't bring them back.
//
// The reaction itself, `Reaction`, is in protocol.js.

import { MAX_REACTIONS } from './limits.js'

const MAX_EMOJI_LENGTH = 16 // flags and ZWJ sequences (families) take a few code points

const EMOJI_PARTS = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️⃣]+$/u
const EMOJI_BASE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u // so `1` or `#` alone aren't
const graphemes = new Intl.Segmenter()

/** One emoji, as a single character on screen: a peer can't react with text, nor with three of them. */
export function isEmoji(value) {
  return (
    typeof value === 'string' &&
    value.length <= MAX_EMOJI_LENGTH &&
    EMOJI_PARTS.test(value) &&
    EMOJI_BASE.test(value) &&
    [...graphemes.segment(value)].length === 1
  )
}

const sameReaction = (a, b) => a.key === b.key && a.emoji === b.emoji && a.from === b.from

/** `from`'s current reaction with `emoji` on the message `key`: on, off (removed), or undefined (never). */
export function findReaction(reactions, { key, emoji, from }) {
  return reactions.find((r) => sameReaction(r, { key, emoji, from }))
}

/** `reactions` with `reaction` in, or null if it's not newer than the one we have. Keeps the newest `MAX_REACTIONS`. */
export function addReaction(reactions, reaction) {
  const current = findReaction(reactions, reaction)
  if (current && reaction.sentAt <= current.sentAt) return null
  const next = [...reactions.filter((r) => r !== current), reaction]
  if (next.length <= MAX_REACTIONS) return next
  return next.sort((a, b) => a.sentAt - b.sentAt).slice(-MAX_REACTIONS)
}

/** The pills under the message `key`: [{ emoji, names, mine }], in the order the emoji were first used. */
export function reactionsOn(reactions, key, me) {
  const pills = new Map() // emoji → { emoji, names, mine }, inserted in the order of first use
  const on = reactions.filter((r) => r.key === key && r.on).sort((a, b) => a.sentAt - b.sentAt)
  for (const { emoji, name, from } of on) {
    const pill = pills.get(emoji) ?? { emoji, names: [], mine: false }
    if (from === me) pill.mine = true
    else pill.names.push(name || 'Friend')
    pills.set(emoji, pill)
  }
  return [...pills.values()].map(({ emoji, names, mine }) => ({ emoji, names: mine ? ['You', ...names] : names, mine }))
}
