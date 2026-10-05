import assert from 'node:assert/strict'
import { test } from 'node:test'
import { thumbnailUrl } from '../js/queue.js'

test('thumbnailUrl: built from the id', () => {
  assert.equal(thumbnailUrl('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
})
