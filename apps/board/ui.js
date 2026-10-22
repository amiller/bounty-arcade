import { COLUMNS, applyAction, emptyBoard, neighbour } from './logic.js'

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
let editing = null
let saves = 0

async function save() {
  const tx = db.transaction('kv', 'readwrite')
  tx.objectStore('kv').put(board, 'board')
  await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onerror = () => fail(tx.error) })
  $('board').dataset.saved = ++saves
}

function dispatch(action) {
  board = applyAction(board, action)
  render()
  return save()
}

const full = col => col === 'doing' && board.columns.doing.length >= board.limits?.doing
function perform(action) {
  try {
    const saved = dispatch(action)
    $('status').textContent = ''
    saved.catch(err => { $('status').textContent = err.message })
  } catch (err) {
    $('status').textContent = err.message
    render()
  }
}

function cardView(col, card, index, count) {
  const btn = (label, action, onclick, disabled = false) => el('button', { textContent: label, title: action, onclick, disabled, type: 'button', dataset: { action } })
  const li = el('li', { className: 'card', draggable: true, dataset: { testid: 'card', id: card.id } })
  li.ondragstart = e => e.dataTransfer.setData('text/plain', card.id)
  if (editing === card.id) {
    const input = el('input', { value: card.text, dataset: { testid: 'edit-input' } })
    const commit = () => { editing = null; input.value.trim() ? perform({ type: 'edit', id: card.id, text: input.value }) : render() }
    input.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { editing = null; render() } }
    input.onblur = () => editing === card.id && commit()
    li.append(input)
    queueMicrotask(() => input.focus())
  } else li.append(el('p', { textContent: card.text }))
  const left = neighbour(col, -1), right = neighbour(col, 1)
  li.append(el('div', { className: 'tools' },
    btn('←', 'left', () => perform({ type: 'move', id: card.id, to: left }), !left || full(left)),
    btn('↑', 'up', () => perform({ type: 'move', id: card.id, to: col, index: index - 1 }), index === 0),
    btn('↓', 'down', () => perform({ type: 'move', id: card.id, to: col, index: index + 1 }), index === count - 1),
    btn('→', 'right', () => perform({ type: 'move', id: card.id, to: right }), !right || full(right)),
    btn('Edit', 'edit', () => { editing = card.id; render() }),
    btn('Delete', 'delete', () => perform({ type: 'delete', id: card.id })),
  ))
  return li
}

function columnView([col, title]) {
  const cards = board.columns[col]
  const input = el('input', { placeholder: 'Add a card', disabled: full(col), required: true, pattern: '.*\\S.*', dataset: { testid: `new-${col}` } })
  const form = el('form', { onsubmit: e => { e.preventDefault(); perform({ type: 'add', column: col, text: input.value }) } },
    input, el('button', { textContent: 'Add', disabled: full(col), dataset: { testid: `add-${col}` } }))
  const section = el('section', { className: 'column', dataset: { testid: `column-${col}`, column: col } },
    el('h2', {}, title, el('span', { textContent: cards.length })),
    el('ol', {}, ...cards.map((card, i) => cardView(col, card, i, cards.length))),
    form)
  if (col === 'doing') {
    const limit = el('input', { type: 'number', min: '1', step: '1', value: board.limits?.doing ?? '', dataset: { testid: 'limit-doing' } })
    limit.oninput = () => {
      if (limit.validity.badInput) { $('status').textContent = 'WIP limit must be a positive integer'; return }
      perform({ type: 'setLimit', column: 'doing', limit: limit.value === '' ? null : Number(limit.value) })
    }
    section.insertBefore(el('label', {}, 'Doing WIP limit ', limit), section.children[1])
  }
  section.ondragover = e => { e.preventDefault(); section.classList.add('over') }
  section.ondragleave = () => section.classList.remove('over')
  section.ondrop = e => { e.preventDefault(); section.classList.remove('over'); perform({ type: 'move', id: e.dataTransfer.getData('text/plain'), to: col }) }
  return section
}

function render() {
  const focused = document.activeElement?.dataset?.testid
  $('board').replaceChildren(...COLUMNS.map(columnView))
  if (focused?.startsWith('new-') || focused === 'limit-doing') document.querySelector(`[data-testid="${focused}"]`).focus()
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

render()
$('board').dataset.ready = 'true'
