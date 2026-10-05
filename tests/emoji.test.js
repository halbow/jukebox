import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, test } from 'node:test'

// gemoji comes from the CDN in the browser: stand in a few entries, in gemoji's shape.
const GEMOJI = [
  { emoji: '😃', names: ['smiley'] },
  { emoji: '😂', names: ['joy'] },
  { emoji: '😛', names: ['stuck_out_tongue'] },
  { emoji: '😹', names: ['joy_cat'] },
  { emoji: '👍', names: ['+1', 'thumbsup'] },
  { emoji: '🐱', names: ['cat'] },
  { emoji: '🙀', names: ['scream_cat'] },
]
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === 'gemoji'
      ? { url: `data:text/javascript,export const gemoji = ${encodeURIComponent(JSON.stringify(GEMOJI))}`, shortCircuit: true }
      : next(specifier, context),
})

let emoji
before(async () => {
  emoji = await import('../js/emoji.js')
  await import('gemoji') // emoji.js loads it in the background: wait for it too
  await new Promise(setImmediate)
})

test('shortcodeAt: an open `:` at the start or after a space', () => {
  assert.deepEqual(emoji.shortcodeAt(':jo', 3), { start: 0, query: 'jo' })
  assert.deepEqual(emoji.shortcodeAt('so :jo', 6), { start: 3, query: 'jo' })
  assert.deepEqual(emoji.shortcodeAt('so :', 4), { start: 3, query: '' })
  assert.deepEqual(emoji.shortcodeAt(':joy and more', 4), { start: 0, query: 'joy' }) // only up to the caret
})

test('shortcodeAt: not in times or URLs', () => {
  assert.equal(emoji.shortcodeAt('at 12:30', 8), null)
  assert.equal(emoji.shortcodeAt('http://x', 8), null)
  assert.equal(emoji.shortcodeAt('hello', 5), null)
})

test('suggest: names starting with the query first, then containing it', () => {
  assert.deepEqual(
    emoji.suggest('cat').map(({ name }) => name),
    ['cat', 'joy_cat', 'scream_cat'],
  )
  assert.deepEqual(emoji.suggest('joy'), [
    { name: 'joy', emoji: '😂' },
    { name: 'joy_cat', emoji: '😹' },
  ])
  assert.deepEqual(emoji.suggest('nothing'), [])
})

test('suggest: an emoticon leads with its emoji, not repeated', () => {
  assert.deepEqual(emoji.suggest('D')[0], { name: 'smiley', emoji: '😃' })
  const names = emoji.suggest('p').map(({ name }) => name)
  assert.equal(names[0], 'stuck_out_tongue')
  assert.equal(names.filter((name) => name === 'stuck_out_tongue').length, 1)
})

test('emojiFor: any of the names, any case', () => {
  assert.equal(emoji.emojiFor('joy'), '😂')
  assert.equal(emoji.emojiFor('JOY'), '😂')
  assert.equal(emoji.emojiFor('thumbsup'), '👍')
  assert.equal(emoji.emojiFor('+1'), '👍')
  assert.equal(emoji.emojiFor('nope'), null)
})

test('completedShortcodeAt: a full shortcode before the caret', () => {
  assert.deepEqual(emoji.completedShortcodeAt('so :joy:', 8), { start: 3, end: 8, emoji: '😂' })
  assert.equal(emoji.completedShortcodeAt('so :nope:', 9), null)
  assert.equal(emoji.completedShortcodeAt('so :joy', 7), null)
})

test('completedShortcodeAt: an emoticon and a space, keeping the space', () => {
  assert.deepEqual(emoji.completedShortcodeAt('ok :D ', 6), { start: 3, end: 6, emoji: '😃 ' })
  assert.equal(emoji.completedShortcodeAt('ok :D', 5), null) // not done typing: could be :Dance
  assert.equal(emoji.completedShortcodeAt('ok :d ', 6), null) // case-sensitive
})

test('replaceShortcodes: known shortcodes and whole-word emoticons', () => {
  assert.equal(emoji.replaceShortcodes('so :joy: :+1:'), 'so 😂 👍')
  assert.equal(emoji.replaceShortcodes(':nope: stays'), ':nope: stays')
  assert.equal(emoji.replaceShortcodes(':D hi :p'), '😃 hi 😛')
  assert.equal(emoji.replaceShortcodes('x:D and :Dance'), 'x:D and :Dance')
})
