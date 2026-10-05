import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callStarted, isCall, streamChanges, videoQuality } from '../js/call.js'
import { MAX_PEOPLE } from '../js/limits.js'

test('isCall: out of the call, or muted and camera flags', () => {
  assert.equal(isCall(null), true)
  assert.equal(isCall({ muted: false, camera: true }), true)
  for (const bad of [undefined, false, {}, { muted: false }, { muted: 'yes', camera: false }, { muted: false, camera: 1 }]) {
    assert.equal(isCall(bad), false, JSON.stringify(bad))
  }
})

test('videoQuality: lower as the call grows, never higher', () => {
  assert.deepEqual(videoQuality(2), { width: 640, height: 360, frameRate: 30 })
  assert.deepEqual(videoQuality(MAX_PEOPLE), { width: 160, height: 90, frameRate: 10 })
  for (let count = 2; count < MAX_PEOPLE; count++) {
    const [now, next] = [videoQuality(count), videoQuality(count + 1)]
    assert.ok(next.width <= now.width && next.frameRate <= now.frameRate, `${count} → ${count + 1}`)
  }
})

test('videoQuality: alone in the call, the best', () => {
  assert.deepEqual(videoQuality(1), videoQuality(2))
})

test('streamChanges: starts for those who joined the call, stops for those who left', () => {
  assert.deepEqual(streamChanges(new Set(['a', 'b']), new Set(['b', 'c'])), { add: ['a'], remove: ['c'] })
})

test('streamChanges: nothing to do when it already matches', () => {
  assert.deepEqual(streamChanges(new Set(['a']), new Set(['a'])), { add: [], remove: [] })
})

test('streamChanges: hanging up stops it for everyone', () => {
  assert.deepEqual(streamChanges(new Set(), new Set(['a', 'b'])), { add: [], remove: ['a', 'b'] })
})

test('callStarted: only when the first one joins', () => {
  assert.equal(callStarted(0, 1), true)
  assert.equal(callStarted(0, 2), true)
  assert.equal(callStarted(1, 2), false)
  assert.equal(callStarted(2, 0), false)
  assert.equal(callStarted(0, 0), false)
})
