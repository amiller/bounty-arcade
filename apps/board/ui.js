import { COLUMNS, emptyBoard, neighbour, createHistory, record, undo, redo } from './logic.js'

const $ = id => document.getElementById(id)
function el(tag, { dataset = {}, ...props } = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props)
  Object.assign(node.dataset, dataset)
  node.append(...kids)
  return node
}

const req = r => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error) })
const db = await new Promise((ok, fail) => {
  const r = indexedDB.open('bounty-arcade-board', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => ok(r.result)
  r.onerror = () => fail(r.error)
})
const store = mode => db.transaction('kv', mode).objectStore('kv')

let board = (await req(store('readonly').get('board'))) ?? emptyBoard()
let history = createHistory(board)
let editing = null
let saves = 0

async function save() {
  const tx = db.transaction('kv', 'readwrite')
  tx.objectStore('kv').put(board, 'board')
  await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onerror = () => fail(tx.error) })
  $('board').dataset.saved = ++saves
}

function dispatch(action) {
  history = record(history, action)
  board = history.present
  render()
  return save()
}

function stepHistory(fn) {
  history = fn(history)
  board = history.present
  render()
  return save()
}

function cardView(col, card, index, count) {
  const btn = (label, action, onclick, disabled = false) => el('button', { textContent: label, title: action, onclick, disabled, type: 'button', dataset: { action } })
  const li = el('li', { className: 'card', draggable: true, dataset: { testid: 'card', id: card.id } })
  li.ondragstart = e => e.dataTransfer.setData('text/plain', card.id)
  if (editing === card.id) {
    const input = el('input', { value: card.text, dataset: { testid: 'edit-input' } })
    const commit = () => { editing = null; input.value.trim() ? dispatch({ type: 'edit', id: card.id, text: input.value }) : render() }
    input.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { editing = null; render() } }
    input.onblur = () => editing === card.id && commit()
    li.append(input)
    queueMicrotask(() => input.focus())
  } else li.append(el('p', { textContent: card.text }))
  const left = neighbour(col, -1), right = neighbour(col, 1)
  li.append(el('div', { className: 'tools' },
    btn('←', 'left', () => dispatch({ type: 'move', id: card.id, to: left }), !left),
    btn('↑', 'up', () => dispatch({ type: 'move', id: card.id, to: col, index: index - 1 }), index === 0),
    btn('↓', 'down', () => dispatch({ type: 'move', id: card.id, to: col, index: index + 1 }), index === count - 1),
    btn('→', 'right', () => dispatch({ type: 'move', id: card.id, to: right }), !right),
    btn('Edit', 'edit', () => { editing = card.id; render() }),
    btn('Delete', 'delete', () => dispatch({ type: 'delete', id: card.id })),
  ))
  return li
}

function columnView([col, title]) {
  const cards = board.columns[col]
  const input = el('input', { placeholder: 'Add a card', required: true, pattern: '.*\\S.*', dataset: { testid: `new-${col}` } })
  const form = el('form', { onsubmit: e => { e.preventDefault(); dispatch({ type: 'add', column: col, text: input.value }) } },
    input, el('button', { textContent: 'Add', dataset: { testid: `add-${col}` } }))
  const section = el('section', { className: 'column', dataset: { testid: `column-${col}`, column: col } },
    el('h2', {}, title, el('span', { textContent: cards.length })),
    el('ol', {}, ...cards.map((card, i) => cardView(col, card, i, cards.length))),
    form)
  section.ondragover = e => { e.preventDefault(); section.classList.add('over') }
  section.ondragleave = () => section.classList.remove('over')
  section.ondrop = e => { e.preventDefault(); dispatch({ type: 'move', id: e.dataTransfer.getData('text/plain'), to: col }) }
  return section
}

function render() {
  const focused = document.activeElement?.dataset?.testid
  $('board').replaceChildren(...COLUMNS.map(columnView))
  if (focused?.startsWith('new-')) document.querySelector(`[data-testid="${focused}"]`).focus()
  $('undo').disabled = history.past.length === 0
  $('redo').disabled = history.future.length === 0
}

$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' }))
  el('a', { href: url, download: 'board.json' }).click()
  URL.revokeObjectURL(url)
}

$('import').onchange = async e => {
  const file = e.target.files[0]
  e.target.value = ''
  try {
    await dispatch({ type: 'import', board: JSON.parse(await file.text()) })
    $('status').textContent = ''
  } catch (err) {
    $('status').textContent = `Import failed: ${err.message}`
  }
}

$('undo').onclick = () => {
  if (history.past.length > 0) stepHistory(undo)
}
$('redo').onclick = () => {
  if (history.future.length > 0) stepHistory(redo)
}

window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault()
    if (e.shiftKey) {
      if (history.future.length > 0) stepHistory(redo)
    } else {
      if (history.past.length > 0) stepHistory(undo)
    }
  }
})

render()
$('board').dataset.ready = 'true'
