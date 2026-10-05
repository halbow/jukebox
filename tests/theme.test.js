import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_THEME, THEMES, isTheme } from '../js/theme.js'

const theme = { id: 'cassette', by: 'Ada', sentAt: 1000, from: 'peer1' }

test('isTheme: accepts every known theme', () => {
  for (const id of Object.keys(THEMES)) assert.equal(isTheme({ ...theme, id }), true, id)
  assert.equal(isTheme({ ...theme, by: undefined }), true)
})

test('isTheme: the default is a known theme', () => {
  assert.equal(Object.hasOwn(THEMES, DEFAULT_THEME.id), true)
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
