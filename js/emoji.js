// Slack-style `:shortcode:` emoji for the chat, on GitHub's gemoji list (pinned in the import map).
// The list is ~350 KB, so it loads in the background and the chat works without it until then.

const MAX_SUGGESTIONS = 8

let byName = null // shortcode → emoji
let names = [] // every shortcode, in gemoji order (popular smileys first)

import('gemoji')
  .then(({ gemoji }) => {
    byName = new Map(gemoji.flatMap(({ emoji, names }) => names.map((name) => [name, emoji])))
    names = [...byName.keys()]
  })
  .catch(() => {}) // no emoji then, chat still works

// A `:` at the start or after a space opens a shortcode, so `12:30` or `http://` don't.
const OPEN_SHORTCODE = /(^|\s):([\w+-]*)$/
const FULL_SHORTCODE = /(^|\s):([\w+-]+):$/

// Typed emoticons, matched case-sensitively and only as a whole word.
const EMOTICONS = {
  ':D': { name: 'smiley', emoji: '😃' },
  ':p': { name: 'stuck_out_tongue', emoji: '😛' },
}
const EMOTICON_ALTERNATIVES = Object.keys(EMOTICONS).join('|')
const EMOTICON = new RegExp(`(^|\\s)(${EMOTICON_ALTERNATIVES})(?=\\s|$)`, 'g')
const TYPED_EMOTICON = new RegExp(`(^|\\s)(${EMOTICON_ALTERNATIVES})\\s$`)

// The shortcode being typed just before the caret: { start, query }, or null.
export function shortcodeAt(text, caret) {
  const match = OPEN_SHORTCODE.exec(text.slice(0, caret))
  if (!match) return null
  return { start: match.index + match[1].length, query: match[2] }
}

// Names starting with the query first, then names containing it; an emoticon (`:D`, `:p`) leads with its emoji.
export function suggest(typed) {
  const emoticon = EMOTICONS[`:${typed}`]
  if (!byName) return emoticon ? [emoticon] : []
  const query = typed.toLowerCase()
  const starts = names.filter((name) => name.startsWith(query))
  const contains = query ? names.filter((name) => !name.startsWith(query) && name.includes(query)) : []
  const found = [...starts, ...contains].filter((name) => name !== emoticon?.name)
  return [...(emoticon ? [emoticon] : []), ...found.map((name) => ({ name, emoji: byName.get(name) }))].slice(
    0,
    MAX_SUGGESTIONS,
  )
}

export function emojiFor(name) {
  return byName?.get(name.toLowerCase()) ?? null
}

// A fully typed `:joy:` (or `:D` / `:p` and a space) just before the caret, ready to swap: { start, end, emoji }, or null.
export function completedShortcodeAt(text, caret) {
  const typed = TYPED_EMOTICON.exec(text.slice(0, caret))
  if (typed) {
    // the space goes back in too, so the caret stays after it
    return { start: typed.index + typed[1].length, end: caret, emoji: EMOTICONS[typed[2]].emoji + ' ' }
  }
  const match = FULL_SHORTCODE.exec(text.slice(0, caret))
  const emoji = match && emojiFor(match[2])
  if (!emoji) return null
  return { start: match.index + match[1].length, end: caret, emoji }
}

// Every known `:shortcode:` and emoticon in a message (pasted ones too); unknown ones stay as typed.
export function replaceShortcodes(text) {
  return text
    .replace(/:([\w+-]+):/g, (whole, name) => emojiFor(name) ?? whole)
    .replace(EMOTICON, (whole, before, emoticon) => before + EMOTICONS[emoticon].emoji)
}
