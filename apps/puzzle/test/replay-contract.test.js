import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as L from '../logic.js'
const levels = JSON.parse(readFileSync(new URL('../levels.json', import.meta.url)))
test('replay hashes preserve level and push case including empty history', () => {
  assert.deepEqual(L.parseReplay('#level=2&moves=lLLLrrrddLLL'), { level: 2, moves: 'lLLLrrrddLLL' })
  assert.deepEqual(L.parseReplay(L.replayUrl(0, L.parse(levels[0].map))), { level: 0, moves: '' })
})
test('share reflects current undo history without mutating the state', () => {
  const solved = L.play(L.parse(levels[0].map), 'rRR')
  const snapshot = structuredClone(solved)
  assert.equal(L.replayUrl(0, solved), '#level=0&moves=rRR')
  assert.equal(L.replayUrl(0, L.undo(solved)), '#level=0&moves=rR')
  assert.deepEqual(solved, snapshot)
})
test('encoding and replay preserve actual board positions and counts across levels', () => {
  for (const [index, sequence] of [[0, 'rRR'], [1, 'DrdLuuullddR'], [2, 'lLLLrrrddLLL']]) {
    const state = L.play(L.parse(levels[index].map), sequence)
    const decoded = L.parseReplay(L.replayUrl(index, state))
    const replayed = L.play(L.parse(levels[decoded.level].map), decoded.moves)
    assert.deepEqual(replayed, state)
    assert.equal(L.isWon(replayed), true)
  }
})
test('parser rejects missing, duplicate, invalid and unsafe parameters', () => {
  assert.equal(typeof L.parseReplay, 'function')
  for (const hash of ['', 'level=0&moves=r', '#level=x&moves=q', '#level=-1&moves=r',
    '#level=1.5&moves=r', '#level=9007199254740992&moves=r', '#level=0', '#moves=r',
    '#level=0&moves=r&moves=l', '#level=0&level=1&moves=r', '#level=0&moves=q',
    '#level=0&moves=r&extra=1'])
    assert.throws(() => L.parseReplay(hash), /replay/i)
})
test('encoder rejects invalid level indices and history', () => {
  assert.equal(typeof L.replayUrl, 'function')
  for (const level of [-1, 0.5, NaN, Infinity, '0'])
    assert.throws(() => L.replayUrl(level, L.parse(levels[0].map)), /replay/i)
  assert.throws(() => L.replayUrl(0, { history: ['q'] }), /replay/i)
})
