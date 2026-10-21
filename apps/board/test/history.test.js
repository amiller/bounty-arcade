import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyBoard, createHistory, record, undo, redo } from '../logic.js'

const add = text => ({ type: 'add', column: 'todo', text })

test('edit, move, reorder and delete round-trip without changing prior histories', () => {
  let h = createHistory(emptyBoard())
  const actions = [add('a'), add('b'),
    { type: 'edit', id: 'c1', text: 'edited' },
    { type: 'move', id: 'c2', to: 'todo', index: 0 },
    { type: 'move', id: 'c1', to: 'doing' },
    { type: 'delete', id: 'c2' }]
  const snapshots = [structuredClone(h.present)]
  for (const action of actions) {
    const before = structuredClone(h)
    const next = record(h, action)
    assert.deepEqual(h, before)
    h = next
    snapshots.push(structuredClone(h.present))
  }
  for (let i = actions.length - 1; i >= 0; i--) {
    const before = structuredClone(h)
    const next = undo(h)
    assert.deepEqual(h, before)
    h = next
    assert.deepEqual(h.present, snapshots[i])
  }
  assert.throws(() => undo(h), /nothing to undo/)
  for (let i = 1; i <= actions.length; i++) {
    const before = structuredClone(h)
    const next = redo(h)
    assert.deepEqual(h, before)
    h = next
    assert.deepEqual(h.present, snapshots[i])
  }
  assert.throws(() => redo(h), /nothing to redo/)
})

test('a branch discards redo and safely reuses the restored nextId', () => {
  const h = record(undo(record(record(createHistory(emptyBoard()), add('a')), add('b'))), add('c'))
  assert.deepEqual(h.present.columns.todo, [{ id: 'c1', text: 'a' }, { id: 'c2', text: 'c' }])
  assert.deepEqual(h.future, [])
})

test('history retains exactly the newest 50 states across undo and redo', () => {
  let h = createHistory(emptyBoard())
  for (let i = 0; i < 60; i++) h = record(h, add(String(i)))
  assert.equal(h.past.length, 50)
  for (let i = 0; i < 50; i++) h = undo(h)
  assert.equal(h.present.columns.todo.length, 10)
  assert.throws(() => undo(h), /nothing to undo/)
  for (let i = 0; i < 50; i++) h = redo(h)
  assert.equal(h.past.length, 50)
  assert.equal(h.present.columns.todo.length, 60)
})

test('successful import clears both directions; failed actions preserve history', () => {
  const h = undo(record(record(createHistory(emptyBoard()), add('a')), add('b')))
  const before = structuredClone(h)
  assert.throws(() => record(h, { type: 'import', board: {} }), /invalid board/)
  assert.throws(() => record(h, add(' ')), /non-empty/)
  assert.deepEqual(h, before)
  const imported = record(h, { type: 'import', board: emptyBoard() })
  assert.deepEqual(imported, createHistory(emptyBoard()))
})

test('initial history snapshots its input and only the present is a persisted board', () => {
  const source = emptyBoard()
  const h = createHistory(source)
  source.columns.todo.push({ id: 'c1', text: 'external mutation' })
  assert.deepEqual(h.present, emptyBoard())
  const changed = record(h, add('saved'))
  const restored = createHistory(JSON.parse(JSON.stringify(changed.present)))
  assert.deepEqual(restored.present, changed.present)
  assert.deepEqual(restored.past, [])
  assert.deepEqual(restored.future, [])
})
