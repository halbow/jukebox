import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chatKey, isNewerEdit } from '../js/chat.js'
import { MAX_CHAT_LENGTH, MAX_QUEUE } from '../js/limits.js'
import {
  createChat,
  createHello,
  createHistoryAnswer,
  createQueue,
  createQueueItem,
  createReaction,
  createState,
  createTheme,
  editChat,
  isCall,
  isChat,
  isHello,
  isHistoryAnswer,
  isQueue,
  isReaction,
  isState,
  isTheme,
} from '../js/protocol.js'
import { EMPTY_QUEUE } from '../js/queue.js'
import { THEMES } from '../js/theme.js'

// ---------- hello ----------

test('createHello: a valid hello, in the call or not', () => {
  const hello = { name: 'Ada', joinedAt: 1000, pausedLocally: false, call: null, from: 'peer1' }
  assert.equal(isHello(createHello(hello)), true)
  assert.equal(isHello(createHello({ ...hello, call: { muted: true, camera: false } })), true)
})

test('isCall: out of the call, or muted and camera flags', () => {
  assert.equal(isCall(null), true)
  assert.equal(isCall({ muted: false, camera: true }), true)
  for (const bad of [undefined, false, {}, { muted: false }, { muted: 'yes', camera: false }, { muted: false, camera: 1 }]) {
    assert.equal(isCall(bad), false, JSON.stringify(bad))
  }
})

// ---------- state ----------

const state = { videoId: 'dQw4w9WgXcQ', playing: true, position: 10, sentAt: 1_000_000, from: 'peer1' }

test('isState: accepts a well-formed state', () => {
  assert.equal(isState(state), true)
})

test('isState: drops malformed ones', () => {
  for (const bad of [
    null,
    { ...state, videoId: 'nope' },
    { ...state, playing: 'yes' },
    { ...state, position: NaN },
    { ...state, position: '10' },
    { ...state, sentAt: undefined },
    { ...state, from: '' },
  ]) {
    assert.equal(isState(bad), false, JSON.stringify(bad))
  }
})

test('createState: a valid state, stamped now', () => {
  const created = createState({ videoId: 'dQw4w9WgXcQ', playing: false, position: 0 }, 'peer1')
  assert.equal(isState(created), true)
  assert.ok(created.sentAt > 0)
})

// ---------- history ----------

test('createHistoryAnswer: a valid answer, yes or no', () => {
  assert.equal(isHistoryAnswer(createHistoryAnswer('peer1', true)), true)
  assert.equal(isHistoryAnswer(createHistoryAnswer('peer1', false)), true)
})

// ---------- chat ----------

const msg = { type: 'chat', text: 'hi', name: 'Ada', sentAt: 1000, from: 'peer1' }
const gif = { id: 'abc123', width: 200, height: 150 }

test('isChat: accepts well-formed messages', () => {
  assert.equal(isChat(msg), true)
  assert.equal(isChat({ ...msg, editedAt: 2000 }), true)
  assert.equal(isChat({ ...msg, gif }), true)
  assert.equal(isChat({ ...msg, text: 'x'.repeat(MAX_CHAT_LENGTH) }), true)
})

test('isChat: drops malformed ones', () => {
  for (const bad of [
    null,
    { ...msg, type: 'state' },
    { ...msg, text: '' },
    { ...msg, text: 'x'.repeat(MAX_CHAT_LENGTH + 1) },
    { ...msg, name: 42 },
    { ...msg, sentAt: 'now' },
    { ...msg, from: '' },
    { ...msg, editedAt: 'later' },
    { ...msg, gif: { id: 'https://evil.example/x.gif', width: 1, height: 1 } },
  ]) {
    assert.equal(isChat(bad), false, JSON.stringify(bad))
  }
})

test('createChat: a valid message, gif only when given', () => {
  const created = createChat('hello', { name: 'Ada', from: 'peer1' })
  assert.equal(isChat(created), true)
  assert.equal('gif' in created, false)
  assert.deepEqual(createChat('cats', { name: 'Ada', from: 'peer1', gif }).gif, gif)
})

test('editChat: same key, newer edit', () => {
  const edited = editChat(msg, 'hello')
  assert.equal(edited.text, 'hello')
  assert.equal(chatKey(edited), chatKey(msg))
  assert.equal(isNewerEdit(edited, msg), true)
  assert.equal(isNewerEdit(msg, edited), false)
  assert.equal(isNewerEdit(msg, msg), false)
})

// ---------- reaction ----------

const reaction = { key: 'peer1:1000', emoji: '👍', on: true, name: 'Ada', sentAt: 2000, from: 'peer2' }

test('isReaction: accepts a well-formed reaction, on or off', () => {
  assert.equal(isReaction(reaction), true)
  assert.equal(isReaction({ ...reaction, on: false }), true)
})

test('isReaction: drops malformed ones', () => {
  for (const bad of [
    null,
    { ...reaction, key: '' },
    { ...reaction, key: 'x'.repeat(49) },
    { ...reaction, emoji: 'nice' },
    { ...reaction, on: 'yes' },
    { ...reaction, name: 42 },
    { ...reaction, sentAt: 'now' },
    { ...reaction, from: '' },
  ]) {
    assert.equal(isReaction(bad), false, JSON.stringify(bad))
  }
})

test('createReaction: a valid reaction', () => {
  assert.equal(isReaction(createReaction('peer1:1000', '🎉', true, { name: 'Ada', from: 'peer2' })), true)
})

// ---------- queue ----------

const item = { id: 'item1', videoId: 'dQw4w9WgXcQ', addedBy: 'Ada', from: 'peer1' }
const queue = { items: [item], sentAt: 1000, from: 'peer1' }

test('isQueue: accepts well-formed queues', () => {
  assert.equal(isQueue(queue), true)
  assert.equal(isQueue({ ...queue, items: [] }), true)
  assert.equal(isQueue({ ...queue, items: Array(MAX_QUEUE).fill(item) }), true)
})

test('isQueue: the empty starting queue is not sent', () => {
  assert.equal(isQueue(EMPTY_QUEUE), false) // no `from`
})

test('isQueue: drops malformed ones', () => {
  for (const bad of [
    null,
    { ...queue, items: 'nope' },
    { ...queue, items: Array(MAX_QUEUE + 1).fill(item) },
    { ...queue, items: [null] },
    { ...queue, items: [{ ...item, id: '' }] },
    { ...queue, items: [{ ...item, videoId: 'https://evil.example' }] },
    { ...queue, items: [{ ...item, addedBy: 1 }] },
    { ...queue, items: [{ ...item, from: undefined }] },
    { ...queue, sentAt: NaN },
    { ...queue, from: '' },
  ]) {
    assert.equal(isQueue(bad), false, JSON.stringify(bad))
  }
})

test('createQueue: a valid queue, items included', () => {
  const items = [createQueueItem('dQw4w9WgXcQ', { name: 'Ada', from: 'peer1' })]
  assert.equal(isQueue(createQueue(items, 'peer1')), true)
  assert.equal(isQueue(createQueue([], 'peer1')), true)
})

// ---------- theme ----------

const theme = { id: 'cassette', by: 'Ada', sentAt: 1000, from: 'peer1' }

test('isTheme: accepts every known theme', () => {
  for (const id of Object.keys(THEMES)) assert.equal(isTheme({ ...theme, id }), true, id)
  assert.equal(isTheme({ ...theme, by: undefined }), true)
})

test('isTheme: drops malformed ones', () => {
  for (const bad of [
    null,
    { ...theme, id: 'nope' },
    { ...theme, id: 'toString' }, // inherited, not a theme
    { ...theme, by: 42 },
    { ...theme, sentAt: '1000' },
    { ...theme, from: '' },
  ]) {
    assert.equal(isTheme(bad), false, JSON.stringify(bad))
  }
})

test('createTheme: a valid theme, with who picked it', () => {
  const created = createTheme('tavern', { name: 'Ada', from: 'peer1' })
  assert.equal(isTheme(created), true)
  assert.equal(created.by, 'Ada')
})
