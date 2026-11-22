import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { COLUMNS, filterBoard } from '../logic.js'

const board = () => ({ nextId: 5, columns: {
  todo: [{ id: 'c1', text: 'Apple' }, { id: 'c2', text: 'Beta' }],
  doing: [{ id: 'c3', text: 'GRAPE' }],
  done: [{ id: 'c4', text: 'Paper' }],
} })

test('search ignores surrounding whitespace and case across all columns without changing the board', () => {
  const input = board(), before = structuredClone(input)
  for (const query of ['AP', '  AP  ', '\t aP \n']) {
    assert.deepEqual(filterBoard(input, query), { todo: ['c1'], doing: ['c3'], done: ['c4'] })
  }
  assert.deepEqual(input, before)
  const phrases = { nextId: 3, columns: { todo: [{ id: 'c1', text: 'alpha beta' }, { id: 'c2', text: 'alpha  beta' }], doing: [], done: [] } }
  assert.deepEqual(filterBoard(phrases, '  ALPHA  BETA  '), { todo: ['c2'], doing: [], done: [] })
})

test('blank and cleared queries still return every card after a padded search', () => {
  const input = board()
  filterBoard(input, '  AP  ')
  for (const query of ['', '   ', '\t\n']) {
    assert.deepEqual(filterBoard(input, query), { todo: ['c1', 'c2'], doing: ['c3'], done: ['c4'] })
  }
})

test('actual board renderer keeps padded-search matching/total counts and restores plain totals when cleared', async () => {
  const source = await readFile(new URL('../ui.js', import.meta.url), 'utf8')
  const functions = source.slice(source.indexOf('function columnView('), source.indexOf("$('search').value = ''"))
  assert.ok(functions.includes('function render()'))
  const search = { value: '' }, output = { replaceChildren(...columns) { this.columns = columns } }
  // Structural DOM fixtures exercise the actual render/columnView functions, not a browser runtime.
  const el = (tag, props = {}, ...children) => ({ tag, props, children })
  const render = new Function('board', 'COLUMNS', 'filterBoard', '$', 'el', 'document', 'cardView', 'dispatch', `${functions}; return render`)(
    board(), COLUMNS, filterBoard, id => id === 'search' ? search : output, el, {},
    (column, card, index) => ({ id: card.id, index }), () => { throw Error('search must not dispatch a stored-board change') },
  )
  const counts = () => output.columns.map(column => String(column.children[0].children[1].props.textContent))
  const cards = () => output.columns.map(column => column.children[1].children.map(card => card.id))
  search.value = '  AP  '; render()
  assert.deepEqual(counts(), ['1/2', '1/1', '1/1'])
  assert.deepEqual(cards(), [['c1'], ['c3'], ['c4']])
  search.value = ' missing '; render()
  assert.deepEqual(counts(), ['0/2', '0/1', '0/1'])
  for (const query of ['   ', '']) {
    search.value = query; render()
    assert.deepEqual(counts(), ['2', '1', '1'])
    assert.deepEqual(cards(), [['c1', 'c2'], ['c3'], ['c4']])
  }
})
