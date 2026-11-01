import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAction, emptyBoard, validate } from '../logic.js'
const add = (column, text = 'task') => ({ type: 'add', column, text })
const limit = value => ({ type: 'setLimit', column: 'doing', limit: value })
const run = (...actions) => actions.reduce(applyAction, emptyBoard())

test('setting and clearing a limit preserves legacy shape and input', () => {
  const old = run(add('todo'))
  const snapshot = structuredClone(old)
  const b = applyAction(old, limit(2))
  assert.deepEqual(b.limits, { doing: 2 })
  assert.deepEqual(old, snapshot)
  assert.deepEqual(applyAction(b, limit(null)), old)
})
test('capacity rejects add and incoming move without mutation or consumed ID', () => {
  const b = run(add('doing'), add('todo'), limit(1))
  const before = structuredClone(b)
  for (const action of [add('doing'), { type: 'move', id: 'c2', to: 'doing' }])
    assert.throws(() => applyAction(b, action), /WIP limit/)
  assert.deepEqual(b, before)
  assert.equal(applyAction(b, add('done')).nextId, 4)
})
test('full Doing permits reordering and outgoing movement releases capacity', () => {
  const b = run(add('doing', 'first'), add('doing', 'second'), add('todo'), limit(2))
  const reordered = applyAction(b, { type: 'move', id: 'c2', to: 'doing', index: 0 })
  assert.deepEqual(reordered.columns.doing.map(c => c.id), ['c2', 'c1'])
  const out = applyAction(reordered, { type: 'move', id: 'c1', to: 'done' })
  assert.equal(applyAction(out, { type: 'move', id: 'c3', to: 'doing' }).columns.doing.length, 2)
  assert.deepEqual(out.limits, { doing: 2 })
})
test('lower bound and invalid setLimit inputs reject atomically', () => {
  const b = run(add('doing'), add('doing'), limit(3))
  assert.throws(() => applyAction(b, limit(1)), /WIP limit/)
  assert.deepEqual(applyAction(b, limit(2)).limits, { doing: 2 })
  for (const n of [0, -1, 1.5, NaN, Infinity, '2', undefined])
    assert.throws(() => applyAction(b, limit(n)))
  assert.throws(() => applyAction(b, { ...limit(2), column: 'todo' }))
  assert.equal(b.limits.doing, 3)
})
test('validation rejects malformed limits and overcapacity but accepts old boards', () => {
  const old = run(add('doing'), add('doing'))
  assert.equal(validate(old), old)
  assert.equal(validate({ ...old, limits: { doing: 2 } }).limits.doing, 2)
  for (const limits of [null, [], {}, 2, { doing: 0 }, { doing: 1.5 }, { doing: '2' }, { todo: 2 }, { doing: 2, done: 3 }, { doing: 1 }])
    assert.throws(() => validate({ ...old, limits }), /invalid board/)
})
test('all reducers and JSON import retain independently cloned limits', () => {
  const b = run(add('doing'), add('todo'), limit(3))
  for (const action of [add('done'), { type: 'edit', id: 'c1', text: 'changed' },
    { type: 'delete', id: 'c1' }, { type: 'move', id: 'c1', to: 'done' },
    { type: 'import', board: JSON.parse(JSON.stringify(b)) }]) {
    const next = applyAction(b, action)
    assert.deepEqual(next.limits, { doing: 3 })
    assert.notEqual(next.limits, b.limits)
    next.limits.doing = 9
    assert.equal(b.limits.doing, 3)
  }
  assert.deepEqual(applyAction(b, { type: 'import', board: emptyBoard() }), emptyBoard())
})
