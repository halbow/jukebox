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

// The shortcode being typed just before the caret: { start, query }, or null.
export function shortcodeAt(text, caret) {
  const match = OPEN_SHORTCODE.exec(text.slice(0, caret))
  if (!match) return null
  return { start: match.index + match[1].length, query: match[2].toLowerCase() }
}

// Names starting with the query first, then names containing it.
export function suggest(query) {
  if (!byName) return []
  const starts = names.filter((name) => name.startsWith(query))
  const contains = query ? names.filter((name) => !name.startsWith(query) && name.includes(query)) : []
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS).map((name) => ({ name, emoji: byName.get(name) }))
}

export function emojiFor(name) {
  return byName?.get(name.toLowerCase()) ?? null
}

// A fully typed `:joy:` just before the caret, ready to swap: { start, end, emoji }, or null.
export function completedShortcodeAt(text, caret) {
  const match = FULL_SHORTCODE.exec(text.slice(0, caret))
  const emoji = match && emojiFor(match[2])
  if (!emoji) return null
  return { start: match.index + match[1].length, end: caret, emoji }
}

// Every known `:shortcode:` in a message (pasted ones too); unknown ones stay as typed.
export function replaceShortcodes(text) {
  return text.replace(/:([\w+-]+):/g, (whole, name) => emojiFor(name) ?? whole)
}
