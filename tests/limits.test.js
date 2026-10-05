import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_NAME_LENGTH, cleanName, isId, isName, isTime, randomId } from '../js/limits.js'

test('randomId: a valid id, different every time', () => {
  const id = randomId()
  assert.equal(isId(id), true)
  assert.notEqual(randomId(), id)
})

test('isId: non-empty string up to 16 chars', () => {
  assert.equal(isId('a'), true)
  assert.equal(isId('x'.repeat(16)), true)
  assert.equal(isId(''), false)
  assert.equal(isId('x'.repeat(17)), false)
  assert.equal(isId(12), false)
  assert.equal(isId(undefined), false)
})

test('isName: a string up to the limit, empty allowed', () => {
  assert.equal(isName(''), true)
  assert.equal(isName('x'.repeat(MAX_NAME_LENGTH)), true)
  assert.equal(isName('x'.repeat(MAX_NAME_LENGTH + 1)), false)
  assert.equal(isName(null), false)
})

test('isTime: finite numbers only', () => {
  assert.equal(isTime(Date.now()), true)
  assert.equal(isTime(0), true)
  assert.equal(isTime(NaN), false)
  assert.equal(isTime(Infinity), false)
  assert.equal(isTime('1'), false)
})

test('cleanName: trims, collapses whitespace, caps', () => {
  assert.equal(cleanName('  Ada \n  Lovelace  '), 'Ada Lovelace')
  assert.equal(cleanName('x'.repeat(40)), 'x'.repeat(MAX_NAME_LENGTH))
  assert.equal(cleanName('   '), '')
  assert.equal(cleanName(undefined), '')
})
