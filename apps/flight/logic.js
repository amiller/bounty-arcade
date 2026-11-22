export const G = 9.81
export const K = 0.0245
export const CLA = 5
export const CD0 = 0.02
export const CDI = 0.1
export const ALPHA_STALL = 0.25
export const T_MAX = 4
export const PITCH_RATE = 1
export const THROTTLE_RATE = 0.5
export const CRUISE = 40

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const isStalled = alpha => Math.abs(alpha) > ALPHA_STALL
// Past the critical angle the wing keeps only 30% of its peak lift.
export const cl = alpha => isStalled(alpha) ? Math.sign(alpha) * CLA * ALPHA_STALL * 0.3 : CLA * alpha
export const cd = alpha => CD0 + CDI * cl(alpha) ** 2

export function trim(v) {
  let alpha = 0, thrust = 0
  for (let i = 0; i < 50; i++) {
    thrust = K * cd(alpha) * v * v / Math.cos(alpha)
    alpha = (G - thrust * Math.sin(alpha)) / (K * CLA * v * v)
  }
  return { pitch: alpha, throttle: thrust / T_MAX }
}

export function makeLevel(seed, { gates = 12, spacing = 10, gateSpacing = 250, firstGate = 300, gap = 30 } = {}) {
  const rng = mulberry32(seed)
  const length = firstGate + gateSpacing * gates + 300
  const waves = [0, 1, 2].map(i => ({ amp: 5 + rng() * 7, freq: (0.004 + rng() * 0.004) * (i + 1), phase: rng() * Math.PI * 2 }))
  const terrain = Array.from({ length: Math.ceil(length / spacing) + 1 }, (_, i) =>
    40 + waves.reduce((h, w) => h + w.amp * Math.sin(w.freq * i * spacing + w.phase), 0))
  const level = { seed, spacing, terrain, gates: [] }
  for (let i = 0; i < gates; i++) {
    const x = firstGate + i * gateSpacing
    const ground = Math.max(...[-30, 0, 30].map(d => terrainAt(level, x + d)))
    level.gates.push({ x, y: ground + gap / 2 + 20 + rng() * 60, gap })
  }
  return level
}

export function terrainAt({ spacing, terrain }, x) {
  const f = Math.min(Math.max(x / spacing, 0), terrain.length - 1)
  const i = Math.min(Math.floor(f), terrain.length - 2)
  return terrain[i] + (terrain[i + 1] - terrain[i]) * (f - i)
}

export function initialState(level, { x = 0, y = 120, speed = CRUISE } = {}) {
  const { pitch, throttle } = trim(speed)
  return { level, t: 0, x, y, vx: speed, vy: 0, pitch, throttle, stalled: false, score: 0, next: 0, results: [], status: 'flying' }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

export function forces({ vx, vy, pitch, throttle }) {
  const v = Math.hypot(vx, vy)
  const alpha = Math.atan2(Math.sin(pitch - Math.atan2(vy, vx)), Math.cos(pitch - Math.atan2(vy, vx)))
  const q = K * v * v
  const lift = q * cl(alpha), drag = q * cd(alpha), thrust = throttle * T_MAX
  const ux = v ? vx / v : 0, uy = v ? vy / v : 0
  return {
    alpha, lift,
    ax: thrust * Math.cos(pitch) - drag * ux - lift * uy,
    ay: thrust * Math.sin(pitch) - drag * uy + lift * ux - G,
  }
}

// input: { pitch: -1|0|1, throttle: -1|0|1 }
export function step(state, input, dt) {
  if (state.status !== 'flying') return state
  const pitch = state.pitch + (input.pitch || 0) * PITCH_RATE * dt
  const throttle = clamp(state.throttle + (input.throttle || 0) * THROTTLE_RATE * dt, 0, 1)
  const { ax, ay, alpha } = forces({ ...state, pitch, throttle })
  const vx = state.vx + ax * dt, vy = state.vy + ay * dt
  const x = state.x + vx * dt, y = state.y + vy * dt
  const s = { ...state, t: state.t + dt, x, y, vx, vy, pitch, throttle, stalled: isStalled(alpha) }
  const gate = s.level.gates[s.next]
  if (gate && state.x < gate.x && x >= gate.x) {
    const gy = state.y + (y - state.y) * (gate.x - state.x) / (x - state.x)
    const hit = Math.abs(gy - gate.y) <= gate.gap / 2
    s.results = [...s.results, hit]
    s.score += hit
    s.next++
    if (s.next === s.level.gates.length) s.status = 'finished'
  }
  if (y <= terrainAt(s.level, x)) s.status = 'crashed'
  return s
}


// Version 1: base-36 seed, followed by control/count runs. Each control is one
// digit (pitch + 1) * 3 + throttle + 1; counts are positive base-36 integers.
const MAX_RUN_STEPS = 1000000
const validControl = input => input && [-1, 0, 1].includes(input.pitch) && [-1, 0, 1].includes(input.throttle)
const badRun = () => { throw new Error('invalid run') }

export function encodeRun(seed, inputs) {
  if (!Number.isSafeInteger(seed) || !Array.isArray(inputs) || inputs.length > MAX_RUN_STEPS) badRun()
  const runs = []
  let previous, count = 0
  for (const input of inputs) {
    if (!validControl(input)) badRun()
    const code = (input.pitch + 1) * 3 + input.throttle + 1
    if (code === previous) count++
    else {
      if (count) runs.push(previous.toString() + count.toString(36))
      previous = code
      count = 1
    }
  }
  if (count) runs.push(previous.toString() + count.toString(36))
  return '1_' + seed.toString(36) + '_' + runs.join('_')
}

export function decodeRun(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]+$/.test(str)) badRun()
  const [version, encodedSeed, ...runs] = str.split('_')
  if (version !== '1' || !/^-?[0-9a-z]+$/.test(encodedSeed ?? '')) badRun()
  const seed = parseInt(encodedSeed, 36)
  if (!Number.isSafeInteger(seed) || seed.toString(36) !== encodedSeed || !runs.length) badRun()
  const inputs = []
  if (runs.length === 1 && runs[0] === '') return { seed, inputs }
  for (const run of runs) {
    if (!/^[0-8][0-9a-z]+$/.test(run)) badRun()
    const code = Number(run[0]), count = parseInt(run.slice(1), 36)
    // Bound expansion of untrusted URL data before allocating it.
    if (!Number.isSafeInteger(count) || count < 1 || count.toString(36) !== run.slice(1) || inputs.length + count > MAX_RUN_STEPS) badRun()
    for (let i = 0; i < count; i++) inputs.push({ pitch: Math.floor(code / 3) - 1, throttle: code % 3 - 1 })
  }
  return { seed, inputs }
}

export function replay(seed, inputs, dt) {
  return inputs.reduce((state, input) => step(state, input, dt), initialState(makeLevel(seed)))
}
