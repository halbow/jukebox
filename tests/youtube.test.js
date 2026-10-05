import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isVideoId, parseVideoId } from '../js/youtube.js'

const ID = 'dQw4w9WgXcQ'

test('parseVideoId: raw id', () => {
  assert.equal(parseVideoId(ID), ID)
  assert.equal(parseVideoId(`  ${ID}\n`), ID)
  assert.equal(parseVideoId('a-b_c-d_e-f'), 'a-b_c-d_e-f')
})

test('parseVideoId: common URL shapes', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=RD`,
    `youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
  ]) {
    assert.equal(parseVideoId(url), ID, url)
  }
})

test('parseVideoId: anything else is null', () => {
  for (const text of [
    '',
    'hello',
    `${ID}x`,
    `https://example.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/@channel',
    'https://youtu.be/',
    'http://[bad',
  ]) {
    assert.equal(parseVideoId(text), null, text)
  }
})

test('isVideoId', () => {
  assert.equal(isVideoId(ID), true)
  assert.equal(isVideoId('short'), false)
  assert.equal(isVideoId(`${ID}x`), false)
  assert.equal(isVideoId('dQw4w9WgXc!'), false)
  assert.equal(isVideoId(undefined), false)
})
