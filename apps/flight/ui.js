import { makeLevel, initialState, step, terrainAt, encodeRun, decodeRun } from './logic.js'

const DT = 1 / 60
const VIEW_H = 220
const $ = id => document.getElementById(id)
const canvas = $('game'), ctx = canvas.getContext('2d')
const keys = new Set()
const bindings = { ArrowUp: ['pitch', 1], KeyW: ['pitch', 1], ArrowDown: ['pitch', -1], KeyS: ['pitch', -1],
  ArrowRight: ['throttle', 1], KeyD: ['throttle', 1], ArrowLeft: ['throttle', -1], KeyA: ['throttle', -1] }
let state, acc = 0, last = performance.now()
let recorded = []        // every input applied to this run, in order
let replaying = null     // inputs being replayed from ?run=
let cursor = 0

function restart() {
  state = initialState(makeLevel(Number($('seed').value)))
  acc = 0
  recorded = []
  replaying = null
  cursor = 0
  share()
}

function share() {
  const el = $('share')
  if (!el) return
  const str = encodeRun(Number($('seed').value), recorded)
  el.href = `?run=${str}`
  el.textContent = `Share run (${recorded.length} steps)`
}

// Replay mode: the page advances the recorded inputs itself, several per frame
// so a long run still finishes quickly, with no key presses.
function startReplay(seed, inputs) {
  $('seed').value = seed
  state = initialState(makeLevel(seed))
  acc = 0
  recorded = []
  replaying = inputs
  cursor = 0
  share()
}

const params = new URLSearchParams(location.search)
const runParam = params.get('run')
if (runParam) {
  try {
    const { seed, inputs } = decodeRun(runParam)
    startReplay(seed, inputs)
  } catch (err) {
    $('status').textContent = `bad run: ${err.message}`
  }
}

function input() {
  const out = { pitch: 0, throttle: 0 }
  for (const k of keys) out[bindings[k][0]] += bindings[k][1]
  return out
}

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return
  if (e.code === 'KeyR') return restart()
  if (!bindings[e.code]) return
  e.preventDefault()
  keys.add(e.code)
})
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('blur', () => keys.clear())
$('level-form').addEventListener('submit', e => { e.preventDefault(); restart(); $('restart').blur() })

function draw() {
  const W = canvas.clientWidth * devicePixelRatio, H = canvas.clientHeight * devicePixelRatio
  if (canvas.width !== W || canvas.height !== H) Object.assign(canvas, { width: W, height: H })
  const scale = H / VIEW_H, viewW = W / scale
  const left = state.x - viewW * 0.3, bottom = Math.max(0, state.y - VIEW_H * 0.6)
  const sx = x => (x - left) * scale, sy = y => H - (y - bottom) * scale
  const { level } = state

  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#5b8fd6'); sky.addColorStop(1, '#cfe3f5')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = Math.floor(left / level.spacing) * level.spacing; x <= left + viewW + level.spacing; x += level.spacing)
    ctx.lineTo(sx(x), sy(terrainAt(level, x)))
  ctx.lineTo(W, H)
  ctx.fillStyle = '#4f7a3a'
  ctx.fill()

  level.gates.forEach((g, i) => {
    if (sx(g.x) < -20 || sx(g.x) > W + 20) return
    const color = i < state.next ? (state.results[i] ? '#2e9e44' : '#d33') : i === state.next ? '#f2a900' : '#8a939c'
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, scale * 1.5)
    ctx.beginPath()
    ctx.moveTo(sx(g.x), sy(terrainAt(level, g.x)))
    ctx.lineTo(sx(g.x), sy(g.y - g.gap / 2))
    ctx.moveTo(sx(g.x), sy(g.y + g.gap / 2))
    ctx.lineTo(sx(g.x), sy(g.y + g.gap / 2 + 8))
    ctx.stroke()
    ctx.fillStyle = color
    for (const y of [g.y - g.gap / 2, g.y + g.gap / 2]) ctx.fillRect(sx(g.x) - 3 * scale, sy(y) - scale, 6 * scale, 2 * scale)
  })

  ctx.save()
  ctx.translate(sx(state.x), sy(state.y))
  ctx.rotate(-state.pitch)
  ctx.scale(scale * 1.5, -scale * 1.5)
  ctx.fillStyle = '#ff8c1a'
  ctx.beginPath(); ctx.moveTo(-6, -0.6); ctx.lineTo(-6 - 6 * state.throttle, 0); ctx.lineTo(-6, 0.6); ctx.fill()
  ctx.fillStyle = state.status === 'crashed' ? '#333' : '#f4f4f4'
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 0.3
  ctx.beginPath()
  ctx.moveTo(6, 0); ctx.lineTo(3, 1.2); ctx.lineTo(-6, 0.8); ctx.lineTo(-7, 3); ctx.lineTo(-5, 3); ctx.lineTo(-3, -0.2); ctx.lineTo(-6, -1)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-2, -2.5); ctx.lineTo(-3, -2.5); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.restore()

  if (state.status !== 'flying') {
    ctx.fillStyle = 'rgba(0,0,0,.45)'
    ctx.fillRect(0, H / 2 - 40 * devicePixelRatio, W, 80 * devicePixelRatio)
    ctx.fillStyle = '#fff'
    ctx.font = `${28 * devicePixelRatio}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${state.status === 'crashed' ? 'Crashed' : 'Finished'}: ${state.score}/${level.gates.length} gates. Press R`, W / 2, H / 2)
  }
}

function hud() {
  $('score').textContent = `${state.score}/${state.level.gates.length}`
  $('speed').textContent = Math.hypot(state.vx, state.vy).toFixed(0)
  $('altitude').textContent = (state.y - terrainAt(state.level, state.x)).toFixed(0)
  $('throttle').textContent = `${Math.round(state.throttle * 100)}%`
  $('status').textContent = state.status
  $('stall').classList.toggle('on', state.stalled)
  canvas.dataset.status = state.status
}

function advance(inp) {
  const before = state
  state = step(state, inp, DT)
  if (state !== before) recorded.push(inp)
}

function frame(now) {
  acc += Math.min(now - last, 100) / 1000
  last = now
  if (replaying) {
    for (; acc >= DT && cursor < replaying.length; acc -= DT) {
      for (let i = 0; i < 6 && cursor < replaying.length; i++) advance(replaying[cursor++])
    }
    if (cursor >= replaying.length) replaying = null
  } else {
    for (; acc >= DT; acc -= DT) advance(input())
  }
  draw()
  hud()
  if (!replaying && cursor === 0) share()
  requestAnimationFrame(frame)
}

restart()
requestAnimationFrame(frame)
