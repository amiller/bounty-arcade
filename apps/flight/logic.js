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
// Full throttle empties the tank in 90 s.
export const BURN = 1 / 90

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
  level.wind = rng() * 24 - 12
  return level
}

export function terrainAt({ spacing, terrain }, x) {
  const f = Math.min(Math.max(x / spacing, 0), terrain.length - 1)
  const i = Math.min(Math.floor(f), terrain.length - 2)
  return terrain[i] + (terrain[i + 1] - terrain[i]) * (f - i)
}

export function initialState(level, { x = 0, y = 120, speed = CRUISE } = {}) {
  const { pitch, throttle } = trim(speed)
  return { level, t: 0, x, y, vx: speed, vy: 0, pitch, throttle, fuel: 1, stalled: false, score: 0, next: 0, results: [], status: 'flying' }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

export function forces({ vx, vy, pitch, throttle, fuel = 1, level }) {
  const wind = (level && level.wind) || 0
  // Lift and drag act on airspeed; the ground track still integrates ground velocity.
  const axr = vx - wind
  const v = Math.hypot(axr, vy)
  const alpha = Math.atan2(Math.sin(pitch - Math.atan2(vy, axr)), Math.cos(pitch - Math.atan2(vy, axr)))
  const q = K * v * v
  const lift = q * cl(alpha), drag = q * cd(alpha), thrust = fuel > 0 ? throttle * T_MAX : 0
  const ux = v ? axr / v : 0, uy = v ? vy / v : 0
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
  const fuel = Math.max(0, (state.fuel ?? 1) - throttle * BURN * dt)
  const { ax, ay, alpha } = forces({ ...state, pitch, throttle, fuel })
  const vx = state.vx + ax * dt, vy = state.vy + ay * dt
  const x = state.x + vx * dt, y = state.y + vy * dt
  const s = { ...state, t: state.t + dt, x, y, vx, vy, pitch, throttle, fuel, stalled: isStalled(alpha) }
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

// ---- run recording / replay (bounty #5) ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64I = Object.fromEntries([...B64].map((c, i) => [c, i]))

function b64encode(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b || 0) >> 4)]
    if (b === undefined) break
    out += B64[((b & 15) << 2) | ((c || 0) >> 6)]
    if (c === undefined) break
    out += B64[c & 63]
  }
  return out
}

function b64decode(str) {
  const bytes = []
  for (let i = 0; i < str.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => B64I[str[i + k]] ?? 0)
    bytes.push((n[0] << 2) | (n[1] >> 4))
    if (str[i + 2] !== undefined) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2))
    if (str[i + 3] !== undefined) bytes.push(((n[2] & 3) << 6) | n[3])
  }
  return bytes
}

const pushVarint = (bytes, value) => {
  let v = value >>> 0
  do {
    let byte = v & 0x7f
    v >>>= 7
    if (v) byte |= 0x80
    bytes.push(byte)
  } while (v)
}

function readVarint(bytes, at) {
  let value = 0, shift = 0, byte
  do {
    byte = bytes[at.i++]
    value += (byte & 0x7f) * 2 ** shift
    shift += 7
  } while (byte & 0x80)
  return value
}

// inputs: per-step { pitch, throttle } with values in {-1, 0, 1}
export function encodeRun(seed, inputs) {
  const bytes = []
  pushVarint(bytes, seed)
  for (let i = 0; i < inputs.length;) {
    const code = (Math.max(-1, Math.min(1, inputs[i].pitch)) + 1) * 3 + (Math.max(-1, Math.min(1, inputs[i].throttle)) + 1)
    let n = 0
    while (i + n < inputs.length && (Math.max(-1, Math.min(1, inputs[i + n].pitch)) + 1) * 3 + (Math.max(-1, Math.min(1, inputs[i + n].throttle)) + 1) === code) n++
    pushVarint(bytes, n)
    pushVarint(bytes, code)
    i += n
  }
  return b64encode(bytes)
}

export function decodeRun(str) {
  const bytes = b64decode(str)
  const at = { i: 0 }
  const seed = readVarint(bytes, at)
  const inputs = []
  while (at.i < bytes.length) {
    const n = readVarint(bytes, at), code = readVarint(bytes, at)
    const pitch = Math.floor(code / 3) - 1, throttle = (code % 3) - 1
    for (let k = 0; k < n; k++) inputs.push({ pitch, throttle })
  }
  return { seed, inputs }
}

export function replay(seed, inputs, dt) {
  return inputs.reduce((s, inp) => step(s, inp, dt), initialState(makeLevel(seed)))
}
