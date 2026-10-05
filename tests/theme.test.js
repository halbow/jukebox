import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_THEME, THEMES } from '../js/theme.js'

test('isTheme: the default is a known theme', () => {
  assert.equal(Object.hasOwn(THEMES, DEFAULT_THEME.id), true)
})

