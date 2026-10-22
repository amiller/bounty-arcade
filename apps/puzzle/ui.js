import { parse, move, undo, isWon, moves, pushes, interior, recordWin } from './logic.js'

const levels = await (await fetch('levels.json')).json()
const $ = id => document.getElementById(id)
const board = $('board'), select = $('level')
const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }
const KEY = 'puzzle-progress'
let state, inside, progress = loadProgress()

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

function saveProgress() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* storage unavailable */ }
}

function label() {
  levels.forEach((lv, i) => {
    const p = progress[lv.name]
    select.options[i].text = `${i + 1}. ${lv.name}` + (p ? ` \u2713 ${p.best}` : '')
  })
}

levels.forEach((lv, i) => select.add(new Option(`${i + 1}. ${lv.name}`, i)))
label()

function load(i) {
  select.value = i
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
  if (isWon(state)) { progress = recordWin(progress, levels[+select.value].name, moves(state)); saveProgress(); label() }
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
select.addEventListener('change', () => {
  try { localStorage.setItem('puzzle-last-level', String(+select.value)) } catch { /* ignore */ }
  load(+select.value); select.blur()
})

addEventListener('beforeunload', () => {
  try { localStorage.setItem('puzzle-last-level', String(+select.value)) } catch { /* ignore */ }
})

load(Number(localStorage.getItem('puzzle-last-level') ?? 0) || 0)
