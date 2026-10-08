import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { addChessJoin, chessText, completesChessCommand, createGame, gameUrl, isChess, isChessCommand, playersOf } from '../js/chess.js'

afterEach(() => mock.restoreAll())

const answer = (status, body = {}) => mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(body), { status }))

test('isChessCommand: only /chess', () => {
  for (const text of ['/chess', '  /CHESS ']) assert.equal(isChessCommand(text), true, text)
  for (const text of ['', 'chess', '/chess now', '/chesss', 'hey /chess']) assert.equal(isChessCommand(text), false, text)
})

test('completesChessCommand: a prefix of /chess, no space yet', () => {
  for (const text of ['/', '/c', '/CH', '/chess']) assert.equal(completesChessCommand(text), true, text)
  for (const text of ['', 'c', '/g', '/chesss', '/chess ']) assert.equal(completesChessCommand(text), false, text)
})

test('isChess: an 8-character alphanumeric id', () => {
  assert.equal(isChess({ id: 'jW85jtQ1' }), true)
  for (const bad of [null, {}, { id: 'short' }, { id: 'jW85jtQ1x' }, { id: '../x/y/z' }, { id: 12345678 }]) {
    assert.equal(isChess(bad), false, JSON.stringify(bad))
  }
})

test('gameUrl and chessText: built from the id', () => {
  assert.equal(gameUrl('jW85jtQ1'), 'https://lichess.org/jW85jtQ1')
  assert.equal(chessText('jW85jtQ1'), '♟ Chess, 5+3: https://lichess.org/jW85jtQ1')
})

test('createGame: an unrated 5+3 open challenge, only its id kept', async () => {
  const fetch = answer(200, { id: 'jW85jtQ1', url: 'https://lichess.org/jW85jtQ1', color: 'random' })
  assert.deepEqual(await createGame(), { id: 'jW85jtQ1' })
  const [url, { method, body }] = fetch.mock.calls[0].arguments
  assert.equal(url, 'https://lichess.org/api/challenge/open')
  assert.equal(method, 'POST')
  assert.equal(body.get('rated'), 'false')
  assert.equal(body.get('clock.limit'), '300')
  assert.equal(body.get('clock.increment'), '3')
})

test('createGame: errors say what went wrong', async () => {
  answer(429)
  await assert.rejects(createGame(), /Too many games/)
  answer(500)
  await assert.rejects(createGame(), /trouble \(500\)/)
  answer(200, { id: '<script>' })
  await assert.rejects(createGame(), /unexpected/)
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('offline')
  })
  await assert.rejects(createGame(), /Couldn't reach Lichess/)
})

const join = (from, sentAt, key = 'peer1:1000') => ({ key, name: from.toUpperCase(), sentAt, from })

test('addChessJoin: a person joins a game once, their first click counts', () => {
  const joins = addChessJoin([], join('ada', 2000))
  assert.deepEqual(joins, [join('ada', 2000)])
  assert.equal(addChessJoin(joins, join('ada', 3000)), null)
  assert.deepEqual(addChessJoin(joins, join('ada', 1500)), [join('ada', 1500)]) // an earlier click, replayed late
  assert.equal(addChessJoin(joins, join('ada', 3000, 'peer1:5000')).length, 2) // another game
})

test('playersOf: the first two to join, whatever order the clicks arrive in', () => {
  const clicks = [join('cy', 4000), join('bob', 3000), join('ada', 2000), join('dan', 1000, 'peer1:5000')]
  const joins = clicks.reduce((all, j) => addChessJoin(all, j), [])
  assert.deepEqual(playersOf(joins, 'peer1:1000'), [
    { name: 'ADA', from: 'ada' },
    { name: 'BOB', from: 'bob' },
  ])
  assert.deepEqual(playersOf(joins, 'peer1:5000'), [{ name: 'DAN', from: 'dan' }])
  assert.deepEqual(playersOf(joins, 'peer1:9999'), [])
})

test('playersOf: same-time clicks break the tie the same way everywhere', () => {
  const a = [join('bob', 2000), join('ada', 2000), join('cy', 2000)].reduce((all, j) => addChessJoin(all, j), [])
  const b = [join('cy', 2000), join('ada', 2000), join('bob', 2000)].reduce((all, j) => addChessJoin(all, j), [])
  assert.deepEqual(playersOf(a, 'peer1:1000'), playersOf(b, 'peer1:1000'))
  assert.deepEqual(playersOf(a, 'peer1:1000').map((p) => p.from), ['ada', 'bob'])
})
