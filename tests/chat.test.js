import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chatKey, createChat, editChat, isChat, isNewerEdit, senderColor } from '../js/chat.js'
import { MAX_CHAT_LENGTH } from '../js/limits.js'

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

test('chatKey: sender and send time', () => {
  assert.equal(chatKey(msg), 'peer1:1000')
  assert.notEqual(chatKey({ ...msg, from: 'peer2' }), chatKey(msg))
})

test('senderColor: stable per peer, one of the 8 theme colors', () => {
  assert.equal(senderColor('peer1'), senderColor('peer1'))
  for (const from of ['a', 'peer1', 'zzzzzzzz', '🎵']) {
    assert.match(senderColor(from), /^var\(--sender-[0-7]\)$/)
  }
})
