import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_QUEUE } from '../js/limits.js'
import { EMPTY_QUEUE, isQueue, thumbnailUrl } from '../js/queue.js'

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

test('thumbnailUrl: built from the id', () => {
  assert.equal(thumbnailUrl('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
})
