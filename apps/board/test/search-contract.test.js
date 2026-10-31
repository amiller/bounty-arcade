import test from 'node:test'
import assert from 'node:assert/strict'
import * as logic from '../logic.js'
const board = () => ({ nextId: 5, columns: { todo: [{ id: 'c1', text: 'Fix login' }, { id: 'c4', text: 'Login again' }], doing: [{ id: 'c2', text: 'login page copy' }], done: [{ id: 'c3', text: 'Ship [v1]' }] } })
test('search matches case-insensitively in every column, preserving card order', () => {
  assert.deepEqual(logic.filterBoard(board(), 'LOGIN'), { todo: ['c1', 'c4'], doing: ['c2'], done: [] })
})
test('empty and whitespace-only queries return all cards', () => {
  for (const query of ['', '   ', '\t\n']) assert.deepEqual(logic.filterBoard(board(), query), { todo: ['c1', 'c4'], doing: ['c2'], done: ['c3'] })
})
test('search uses literal substrings, not regular expressions', () => {
  assert.deepEqual(logic.filterBoard(board(), '[v1]'), { todo: [], doing: [], done: ['c3'] })
  assert.deepEqual(logic.filterBoard(board(), 'missing'), { todo: [], doing: [], done: [] })
})
test('filtering does not mutate frozen source or export and returns independent arrays', () => {
  const b = board(), before = JSON.stringify(b)
  for (const cards of Object.values(b.columns)) { cards.forEach(Object.freeze); Object.freeze(cards) }
  Object.freeze(b.columns); Object.freeze(b)
  const ids = logic.filterBoard(b, 'login'); ids.todo.pop()
  assert.equal(JSON.stringify(b), before)
  assert.deepEqual(logic.filterBoard(b, 'login').todo, ['c1', 'c4'])
})
test('filtering reflects additions, edits, and moves without altering reducer behavior', () => {
  let b = logic.applyAction(board(), { type: 'add', column: 'done', text: 'LOGIN docs' })
  assert.deepEqual(logic.filterBoard(b, 'login').done, ['c5'])
  b = logic.applyAction(b, { type: 'edit', id: 'c1', text: 'Logout' })
  b = logic.applyAction(b, { type: 'move', id: 'c4', to: 'doing' })
  assert.deepEqual(logic.filterBoard(b, 'login'), { todo: [], doing: ['c2', 'c4'], done: ['c5'] })
})
test('empty board has an empty result for each column', () => {
  assert.deepEqual(logic.filterBoard(logic.emptyBoard(), 'x'), { todo: [], doing: [], done: [] })
})
