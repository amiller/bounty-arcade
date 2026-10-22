import { parse, move, undo, isWon, moves, pushes, interior, recordWin } from './logic.js'

const levels = await (await fetch('levels.json')).json()
const $ = id => document.getElementById(id)
const board = $('board'), select = $('level')
const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }
let state, inside

let progress = {}
try {
  progress = JSON.parse(localStorage.getItem('puzzle-progress')) || {}
} catch {}

function updateSelectLabels() {
  levels.forEach((lv, i) => {
    const best = progress[lv.name]?.best
    const label = best !== undefined ? `${i + 1}. ${lv.name} ✓ ${best}` : `${i + 1}. ${lv.name}`
    if (select.options[i]) {
      select.options[i].text = label
    } else {
      select.add(new Option(label, i))
    }
  })
}

updateSelectLabels()

function load(i) {
  select.value = i
  try {
    localStorage.setItem('puzzle-level', i)
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
  const curMoves = moves(state)
  $('moves').textContent = curMoves
  $('pushes').textContent = pushes(state)
  const won = isWon(state)
  const last = +select.value === levels.length - 1
  $('status').textContent = won ? (last ? 'Solved! That was the last level.' : 'Solved! Press N for the next level.') : ''

  if (won) {
    const curLevel = levels[+select.value]
    if (curLevel) {
      progress = recordWin(progress, curLevel.name, curMoves)
      try {
        localStorage.setItem('puzzle-progress', JSON.stringify(progress))
      } catch {}
      updateSelectLabels()
    }
  }
}

function step(dir) {
  if (isWon(state)) return
  state = move(state, dir)
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

let initialLevel = 0
try {
  const saved = localStorage.getItem('puzzle-level') ?? localStorage.getItem('puzzle-last-level')
  if (saved !== null && !isNaN(Number(saved)) && Number(saved) >= 0 && Number(saved) < levels.length) {
    initialLevel = Number(saved)
  }
} catch {}
load(initialLevel)
