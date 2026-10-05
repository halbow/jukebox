import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_REACTIONS } from '../js/limits.js'
import { addReaction, findReaction, isEmoji, reactionsOn } from '../js/reactions.js'

const reaction = { key: 'peer1:1000', emoji: '👍', on: true, name: 'Ada', sentAt: 2000, from: 'peer2' }

test('isEmoji: one emoji, flags and ZWJ sequences included', () => {
  for (const emoji of ['👍', '❤️', '👍🏽', '🇫🇷', '👨‍👩‍👧‍👦', '1️⃣']) assert.equal(isEmoji(emoji), true, emoji)
})

test('isEmoji: no text, no digits, no more than one', () => {
  for (const bad of [null, '', 'a', 'lol', '1', '#', '👍👍', '👍 ', '<b>']) assert.equal(isEmoji(bad), false, bad)
})

test('addReaction: the newest per message, emoji and person wins', () => {
  const off = { ...reaction, on: false, sentAt: 3000 }
  const reactions = addReaction([], reaction)
  assert.deepEqual(reactions, [reaction])
  assert.deepEqual(addReaction(reactions, off), [off])
  assert.equal(addReaction([off], reaction), null, 'an older "on" replayed later stays off')
  assert.equal(addReaction(reactions, reaction), null, 'a replay changes nothing')
  assert.equal(addReaction(reactions, { ...reaction, emoji: '🎉' }).length, 2)
  assert.equal(addReaction(reactions, { ...reaction, from: 'peer3' }).length, 2)
  assert.equal(findReaction([reaction, off], { key: reaction.key, emoji: '🎉', from: 'peer2' }), undefined)
})

test('addReaction: keeps the newest MAX_REACTIONS', () => {
  const full = Array.from({ length: MAX_REACTIONS }, (_, i) => ({ ...reaction, from: `p${i}`, sentAt: i }))
  const reactions = addReaction(full, { ...reaction, from: 'late', sentAt: MAX_REACTIONS })
  assert.equal(reactions.length, MAX_REACTIONS)
  assert.equal(reactions.some((r) => r.from === 'p0'), false)
  assert.equal(reactions.at(-1).from, 'late')
})

test('reactionsOn: one pill per emoji, in order of first use, you first', () => {
  const reactions = [
    { ...reaction, emoji: '🎉', from: 'peer3', name: 'Bob', sentAt: 3000 },
    reaction,
    { ...reaction, from: 'me', name: 'Me', sentAt: 4000 },
    { ...reaction, emoji: '🔥', from: 'peer3', on: false },
    { ...reaction, key: 'peer1:9999', emoji: '😂' },
    { ...reaction, emoji: '😮', from: 'peer4', name: '', sentAt: 5000 },
  ]
  assert.deepEqual(reactionsOn(reactions, 'peer1:1000', 'me'), [
    { emoji: '👍', names: ['You', 'Ada'], mine: true },
    { emoji: '🎉', names: ['Bob'], mine: false },
    { emoji: '😮', names: ['Friend'], mine: false },
  ])
  assert.deepEqual(reactionsOn(reactions, 'nope', 'me'), [])
})
