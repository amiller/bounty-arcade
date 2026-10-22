import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CRUISE, forces, initialState, makeLevel, step, trim } from '../logic.js'

const DT = 1 / 60
const flat = wind => ({
  spacing: 1e6,
  terrain: [0, 0],
  gates: [{ x: 1e6, y: 120, gap: 40 }],
  ...(wind === undefined ? {} : { wind }),
})
const withoutLevel = ({ level, ...state }) => state
const fly = (wind, seconds) => {
  let state = initialState(flat(wind))
  for (let i = 0; i < seconds * 60; i++) state = step(state, {}, DT)
  assert.equal(state.status, 'flying')
  assert.ok(Math.abs(state.t - seconds) < 1e-8)
  return state
}

test('wind is finite, bounded and reproducible for every tested seed', () => {
  const winds = Array.from({ length: 50 }, (_, i) => {
    const seed = i + 1
    const level = makeLevel(seed)
    assert.equal(level.wind, makeLevel(seed).wind)
    assert.ok(Number.isFinite(level.wind), `seed ${seed} has no finite wind`)
    assert.ok(level.wind >= -12 && level.wind <= 12)
    return level.wind
  })
  assert.ok(winds.some(wind => wind < 0))
  assert.ok(winds.some(wind => wind > 0))
  assert.ok(winds.some(wind => wind < -10))
  assert.ok(winds.some(wind => wind > 10))
})

test('explicit zero wind preserves the entire legacy integration sequence', () => {
  let absent = initialState(flat())
  let zero = initialState(flat(0))
  for (let i = 0; i < 600; i++) {
    const input = {
      pitch: i % 180 === 0 ? 1 : i % 180 === 1 ? -1 : 0,
      throttle: i % 200 === 0 ? 1 : i % 200 === 1 ? -1 : 0,
    }
    absent = step(absent, input, DT)
    zero = step(zero, input, DT)
    assert.deepEqual(withoutLevel(zero), withoutLevel(absent))
  }
  assert.equal(absent.status, 'flying')
  assert.ok(Math.abs(absent.t - 10) < 1e-8)
})

test('headwind trim holds altitude and ground speed for a full minute', () => {
  let state = initialState(flat(-10))
  state = { ...state, vx: 30, ...trim(CRUISE) }
  for (let i = 0; i < 3600; i++) state = step(state, {}, DT)
  assert.equal(state.status, 'flying')
  assert.ok(Math.abs(state.y - 120) < 1e-6, `altitude ${state.y}`)
  assert.ok(Math.abs(state.vx - 30) < 1e-6, `ground speed ${state.vx}`)
  assert.ok(Math.abs(state.t - 60) < 1e-8)
})

test('tailwind covers more ground while both runs retain trim altitude', () => {
  const headwind = fly(-10, 20)
  const tailwind = fly(10, 20)
  assert.ok(tailwind.x - headwind.x >= 390)
  assert.ok(Math.abs(tailwind.y - 120) < 1e-6)
  assert.ok(Math.abs(headwind.y - 120) < 1e-6)
})

test('lift and drag use the full air-relative velocity vector', () => {
  for (const wind of [-12, -5, 0, 7, 12]) {
    for (const vy of [-4, 0, 3]) {
      const state = { vx: 35, vy, pitch: 0.08, throttle: 0.4 }
      assert.deepEqual(
        forces({ ...state, level: flat(wind) }),
        forces({ ...state, vx: state.vx - wind }),
      )
    }
  }
})

test('initial trim uses airspeed and exposes the corresponding ground velocity', () => {
  for (const wind of [-12, 0, 12]) {
    const state = initialState(flat(wind))
    assert.equal(state.vx, CRUISE + wind)
    assert.deepEqual({ pitch: state.pitch, throttle: state.throttle }, trim(CRUISE))
    const acceleration = forces(state)
    assert.ok(Math.abs(acceleration.ax) < 1e-10)
    assert.ok(Math.abs(acceleration.ay) < 1e-10)
  }
})

test('custom starting airspeed is independent of wind', () => {
  const state = initialState(flat(-7), { x: 20, y: 250, speed: 48 })
  assert.equal(state.x, 20)
  assert.equal(state.y, 250)
  assert.equal(state.vx, 41)
  assert.deepEqual({ pitch: state.pitch, throttle: state.throttle }, trim(48))
})

test('wind affects forces without moving the level or mutating the input', () => {
  const level = Object.freeze(flat(10))
  const state = Object.freeze(initialState(level))
  const snapshot = JSON.stringify(state)
  const next = step(state, {}, DT)
  assert.equal(JSON.stringify(state), snapshot)
  assert.equal(next.level, level)
  assert.notEqual(next, state)
  assert.ok(Math.abs(next.x - 50 * DT) < 1e-10)
})
