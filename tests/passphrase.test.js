import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPassphrase, parsePassphrase } from '../js/passphrase.js'

test('createPassphrase: 8 words, dash-separated, that parse back', () => {
  const phrase = createPassphrase()
  assert.equal(phrase.split('-').length, 8)
  assert.equal(parsePassphrase(phrase), phrase)
})

test('createPassphrase: different every time', () => {
  assert.notEqual(createPassphrase(), createPassphrase())
})

test('parsePassphrase: case, spaces, dashes and underscores do not matter', () => {
  const phrase = createPassphrase()
  const words = phrase.split('-')
  assert.equal(parsePassphrase(words.join(' ').toUpperCase()), phrase)
  assert.equal(parsePassphrase(`  ${words.join(' - ')}  `), phrase)
  assert.equal(parsePassphrase(words.join('_')), phrase)
})

test('parsePassphrase: refuses made-up phrases', () => {
  const words = createPassphrase().split('-')
  assert.equal(parsePassphrase(words.slice(0, 7).join('-')), '') // too short
  assert.equal(parsePassphrase([...words, words[0]].join('-')), '') // too long
  assert.equal(parsePassphrase([...words.slice(0, 7), 'notaword'].join('-')), '')
  assert.equal(parsePassphrase(''), '')
  assert.equal(parsePassphrase(undefined), '')
  assert.equal(parsePassphrase(42), '')
})
