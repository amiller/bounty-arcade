import { parse, move, undo, isWon, moves, pushes, interior, recordWin } from './logic.js'

const levels = await (await fetch('levels.json')).json()
const $ = id => document.getElementById(id)
const board = $('board'), select = $('level')
const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }
let state, inside

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem('puzzle-progress') || '{}')
  } catch {
    return {}
  }
}

function updateOptions() {
  const progress = getProgress()
  levels.forEach((lv, i) => {
    const entry = progress[lv.name]
    const label = entry ? `${i + 1}. ${lv.name} ✓ ${entry.best}` : `${i + 1}. ${lv.name}`
    if (select.options[i]) {
      select.options[i].text = label
    } else {
      select.add(new Option(label, i))
    }
  })
}

function load(i) {
  select.value = i
  try {
    localStorage.setItem('puzzle-last-level', i)
  } catch {}
  state = parse(levels[i].map)
  inside = interior(state)
  board.style.gridTemplateColumns = `repeat(${state.w}, var(--size))`
  board.style.setProperty('--size', `min(2.5rem, ${88 / state.w}vw)`)
  draw()
}

function draw() {
  board.replaceChildren(...Array.from({ length: state.w * state.h }, (_, i) => {
    const c = document.createElement('div')
    c.className = 'cell ' + (state.walls.has(i) ? 'wall' : inside.has(i) ? 'floor' : 'outside')
    if (state.goals.has(i)) c.classList.add('goal')
    if (state.boxes.includes(i)) c.classList.add('box')
    if (i === state.player) c.classList.add('player')
    return c
  }))
  $('moves').textContent = moves(state)
  $('pushes').textContent = pushes(state)
  const last = +select.value === levels.length - 1
  $('status').textContent = isWon(state) ? (last ? 'Solved! That was the last level.' : 'Solved! Press N for the next level.') : ''
}

function step(dir) {
  if (isWon(state)) return
  state = move(state, dir)
  if (isWon(state)) {
    const lv = levels[+select.value]
    const updated = recordWin(getProgress(), lv.name, moves(state))
    try {
      localStorage.setItem('puzzle-progress', JSON.stringify(updated))
    } catch {}
    updateOptions()
  }
  draw()
}

document.addEventListener('keydown', e => {
  if (e.target === select) return
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (keys[k]) step(keys[k])
  else if (k === 'z' || k === 'Backspace') { state = undo(state); draw() }
  else if (k === 'r') load(+select.value)
  else if (k === 'n' && isWon(state) && +select.value < levels.length - 1) load(+select.value + 1)
  else return
  e.preventDefault()
})
document.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => step(b.dataset.dir)))
$('undo').addEventListener('click', () => { state = undo(state); draw() })
$('restart').addEventListener('click', () => load(+select.value))
select.addEventListener('change', () => { load(+select.value); select.blur() })

updateOptions()
let lastLevel = 0
try {
  const saved = localStorage.getItem('puzzle-last-level')
  if (saved != null && +saved >= 0 && +saved < levels.length) {
    lastLevel = +saved
  }
} catch {}
load(lastLevel)

