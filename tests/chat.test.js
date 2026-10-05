import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chatKey, senderColor } from '../js/chat.js'

const msg = { type: 'chat', text: 'hi', name: 'Ada', sentAt: 1000, from: 'peer1' }

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
