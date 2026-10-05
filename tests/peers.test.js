import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, test } from 'node:test'
import { connect, isNewer, on, shareNewest } from '../js/peers.js'
import { room, sent } from './fakes/trystero.js'

// Trystero comes from the CDN in the browser: `connect` gets the fake instead.
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === 'trystero'
      ? { url: new URL('./fakes/trystero.js', import.meta.url).href, shortCircuit: true }
      : next(specifier, context),
})

test('isNewer: the later sentAt wins', () => {
  assert.equal(isNewer({ sentAt: 2, from: 'a' }, { sentAt: 1, from: 'z' }), true)
  assert.equal(isNewer({ sentAt: 1, from: 'z' }, { sentAt: 2, from: 'a' }), false)
})

test('isNewer: ties broken by peer id, the same way on every peer', () => {
  const a = { sentAt: 1, from: 'a' }
  const b = { sentAt: 1, from: 'b' }
  assert.equal(isNewer(b, a), true)
  assert.equal(isNewer(a, b), false)
})

test('isNewer: a value is not newer than itself', () => {
  const a = { sentAt: 1, from: 'a' }
  assert.equal(isNewer(a, a), false)
})

// The room's theme, shared with shareNewest like the state and the queue.
let mine
const accepted = []
const hellos = []
const theme = (id, sentAt, from) => ({ id, sentAt, from })

before(async () => {
  shareNewest('theme', { current: () => mine, accept: (msg) => accepted.push(msg) })
  on('hello', (msg, peerId) => hellos.push({ msg, peerId }))
  await connect('some-passphrase', { onUnreachable: () => {} })
})

beforeEach(() => {
  mine = theme('cosy', 1000, 'me')
  accepted.length = sent.length = hellos.length = 0
})

test('shareNewest: a newcomer gets ours', () => {
  room.join('peerA')
  assert.deepEqual(sent, [{ type: 'theme', msg: mine, to: 'peerA' }])
})

test('shareNewest: nothing to share, nothing sent', () => {
  mine = theme('cosy', 0, '') // the default, never picked
  room.join('peerB')
  mine = null
  room.join('peerC')
  assert.deepEqual(sent, [])
})

test('shareNewest: a newer one is accepted', () => {
  const newer = theme('tavern', 2000, 'peerA')
  room.receive('theme', newer, 'peerA')
  assert.deepEqual(accepted, [newer])
  assert.deepEqual(sent, [])
})

test('shareNewest: anything is accepted when we have nothing', () => {
  mine = null
  const theirs = theme('tavern', 1, 'peerA')
  room.receive('theme', theirs, 'peerA')
  assert.deepEqual(accepted, [theirs])
})

test('shareNewest: an older one gets ours back, to that peer only', () => {
  room.receive('theme', theme('tavern', 500, 'peerA'), 'peerA')
  assert.deepEqual(accepted, [])
  assert.deepEqual(sent, [{ type: 'theme', msg: mine, to: 'peerA' }])
})

test('shareNewest: the same one again changes nothing', () => {
  room.receive('theme', { ...mine }, 'peerA')
  assert.deepEqual(accepted, [])
  assert.deepEqual(sent, [])
})

test('shareNewest: same sentAt, the higher peer id wins on both sides', () => {
  room.receive('theme', theme('tavern', 1000, 'zed'), 'peerA') // 'zed' > 'me'
  room.receive('theme', theme('festival', 1000, 'abe'), 'peerB') // 'abe' < 'me'
  assert.deepEqual(accepted, [theme('tavern', 1000, 'zed')])
  assert.deepEqual(sent, [{ type: 'theme', msg: mine, to: 'peerB' }])
})

test('connect: malformed messages are dropped before any handler', () => {
  room.receive('theme', theme('not-a-theme', 2000, 'peerA'), 'peerA')
  room.receive('theme', null, 'peerA')
  room.receive('hello', { name: 'x'.repeat(100), joinedAt: 1, pausedLocally: false, from: 'peerA' }, 'peerA')
  room.receive('hello', { name: 'Ada', joinedAt: 1, from: 'peerA' }, 'peerA') // no pausedLocally
  assert.deepEqual(accepted, [])
  assert.deepEqual(sent, [])
  assert.deepEqual(hellos, [])
})

test('connect: well-formed ones reach their handler, with the sender', () => {
  const hello = { name: 'Ada', joinedAt: 1, pausedLocally: false, from: 'ada' }
  room.receive('hello', hello, 'peerA')
  assert.deepEqual(hellos, [{ msg: hello, peerId: 'peerA' }])
})
