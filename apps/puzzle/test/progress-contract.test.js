import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../logic.js'

test('a first win records the level and best moves', () => {
  assert.deepEqual(L.recordWin({}, 'Corner', 12), { Corner: { best: 12 } })
})

test('worse and equal wins retain the best, better wins replace it', () => {
  const progress = { Corner: { best: 12 } }
  for (const [moves, best] of [[20, 12], [12, 12], [9, 9]]) {
    assert.equal(L.recordWin(progress, 'Corner', moves).Corner.best, best)
  }
})

test('recording preserves frozen input and unrelated levels', () => {
  const progress = Object.freeze({ Corner: Object.freeze({ best: 12 }), Other: Object.freeze({ best: 5 }) })
  const next = L.recordWin(progress, 'Corner', 9)
  assert.notEqual(next, progress)
  assert.deepEqual(progress, { Corner: { best: 12 }, Other: { best: 5 } })
  assert.deepEqual(next, { Corner: { best: 9 }, Other: { best: 5 } })
})

test('even an unchanged best returns a new progress object', () => {
  const progress = { Corner: { best: 12 } }
  assert.notEqual(L.recordWin(progress, 'Corner', 20), progress)
})

test('progress round trips as plain JSON with independent level records', () => {
  let progress = L.recordWin({}, 'Corner', 12)
  progress = L.recordWin(JSON.parse(JSON.stringify(progress)), 'First Push', 3)
  assert.deepEqual(progress, { Corner: { best: 12 }, 'First Push': { best: 3 } })
})

test('zero is retained as a valid best score', () => {
  assert.deepEqual(L.recordWin({ Done: { best: 0 } }, 'Done', 2), { Done: { best: 0 } })
})

test('level names that match object properties are ordinary own records', () => {
  const progress = L.recordWin({}, '__proto__', 7)
  assert.equal(Object.getPrototypeOf(progress), Object.prototype)
  assert.equal(Object.hasOwn(progress, '__proto__'), true)
  assert.deepEqual(progress.__proto__, { best: 7 })
  assert.deepEqual(L.recordWin({}, 'constructor', 4).constructor, { best: 4 })
})
