import { parse, move, undo, isWon, moves, pushes, interior, replayUrl, parseReplay } from './logic.js'

const levels = await (await fetch('levels.json')).json()
const $ = id => document.getElementById(id)
const board = $('board'), select = $('level')
const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }
let state, inside

levels.forEach((lv, i) => select.add(new Option(`${i + 1}. ${lv.name}`, i)))

function load(i) {
  $('share-url').value = ''
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
  draw()
}

document.addEventListener('keydown', e => {
  if (e.target === select || e.target.tagName === 'INPUT') return
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

$('share').addEventListener('click', () => {
  const url = new URL(location.href)
  url.hash = replayUrl(+select.value, state)
  $('share-url').value = url.href
})

load(0)
if (location.hash) {
  try {
    const replay = parseReplay(location.hash)
    if (replay.level >= levels.length) throw new Error('Replay level does not exist')
    load(replay.level)
    for (let i = 0; i < replay.moves.length; i++) {
      const next = move(state, replay.moves[i].toLowerCase())
      if (next === state) throw new Error('Replay blocked at step ' + (i + 1))
      state = next
    }
    draw()
  } catch (error) {
    // Keep every successful move before a blocked step; never apply later moves.
    draw()
    $('status').textContent = error.message
  }
}
