import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completesCommand, gifStillUrl, gifUrl, isGif, parseGiphyCommand } from '../js/giphy.js'

test('parseGiphyCommand: a search', () => {
  assert.deepEqual(parseGiphyCommand('/giphy cats'), { query: 'cats' })
  assert.deepEqual(parseGiphyCommand('  /GIPHY   happy cats  '), { query: 'happy cats' })
  assert.deepEqual(parseGiphyCommand('/giphy line\nbreak'), { query: 'line\nbreak' })
})

test('parseGiphyCommand: no query', () => {
  assert.deepEqual(parseGiphyCommand('/giphy'), { query: '' })
  assert.deepEqual(parseGiphyCommand('/giphy   '), { query: '' })
})

test('parseGiphyCommand: the key prompt', () => {
  assert.deepEqual(parseGiphyCommand('/giphy key'), { key: true })
  assert.deepEqual(parseGiphyCommand('/giphy KEY '), { key: true })
  assert.deepEqual(parseGiphyCommand('/giphy key lime'), { query: 'key lime' })
})

test('parseGiphyCommand: anything else is null', () => {
  for (const text of ['', 'giphy cats', '/giphycats', '/gif cats', 'hey /giphy cats']) {
    assert.equal(parseGiphyCommand(text), null, text)
  }
})

test('completesCommand: a prefix of /giphy, no space yet', () => {
  for (const text of ['/', '/g', '/gi', '/GIP', '/giphy']) assert.equal(completesCommand(text), true, text)
  for (const text of ['', 'g', '/x', '/giphyy', '/giphy ', '/gi ph']) assert.equal(completesCommand(text), false, text)
})

test('isGif: an alphanumeric id and sane sizes', () => {
  assert.equal(isGif({ id: 'abc123XYZ', width: 200, height: 150 }), true)
  for (const bad of [
    null,
    { id: '', width: 200, height: 150 },
    { id: '../x', width: 200, height: 150 },
    { id: 'x'.repeat(65), width: 200, height: 150 },
    { id: 'abc', width: 0, height: 150 },
    { id: 'abc', width: 200, height: 1001 },
    { id: 'abc', width: 200.5, height: 150 },
    { id: 'abc', width: '200', height: 150 },
  ]) {
    assert.equal(isGif(bad), false, JSON.stringify(bad))
  }
})

test('gif URLs: built from the id', () => {
  assert.equal(gifUrl('abc'), 'https://media.giphy.com/media/abc/200.webp')
  assert.equal(gifStillUrl('abc'), 'https://media.giphy.com/media/abc/200_s.gif')
})
