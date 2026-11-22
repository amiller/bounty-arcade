import test from 'node:test'
import assert from 'node:assert/strict'
import { makeLevel, initialState, forces, step, CRUISE } from '../logic.js'

const flat = wind => ({ spacing: 10, terrain: Array(2000).fill(0), gates: [], wind })
test('initial speed is airspeed, including custom speed and both wind signs', () => {
  for (const wind of [-12, 0, 12]) {
    const state = initialState(flat(wind), { speed: 35 })
    assert.equal(state.vx, 35 + wind)
    const { ax, ay } = forces(state)
    assert.ok(Math.abs(ax) < 1e-9 && Math.abs(ay) < 1e-9)
  }
})
test('forces are invariant under a horizontal change of reference frame', () => {
  const state = { vx: 35, vy: -4, pitch: 0.13, throttle: 0.5 }
  const original = { ...state }
  for (const wind of [-12, 0, 12]) {
    assert.deepEqual(forces({ ...state, vx: state.vx + wind, level: flat(wind) }), forces(state))
  }
  assert.deepEqual(state, original)
})
test('wind does not change the generated terrain or gates', () => {
  // Stable original seed-7 geometry, verified against the specified bounty base.
  const { wind, ...level } = makeLevel(7)
  assert.equal(level.terrain[0], 42.08192850978788)
  assert.equal(level.gates[0].y, 133.48826911482072)
  assert.ok(Number.isFinite(wind))
})
test('position uses ground velocity and does not add wind twice', () => {
  for (const wind of [-10, 10]) {
    const s = step(initialState(flat(wind)), {}, 0.5)
    assert.ok(Math.abs(s.x - (CRUISE + wind) * 0.5) < 1e-9)
    assert.ok(Math.abs(s.y - 120) < 1e-9)
  }
})
test('unkeyed levels and explicit zero wind have identical trajectories', () => {
  const unkeyed = flat(undefined); delete unkeyed.wind
  let a = initialState(unkeyed), b = initialState(flat(0))
  for (let i = 0; i < 600; i++) {
    const input = { pitch: i % 100 === 0 ? 1 : 0, throttle: i < 30 ? 1 : 0 }
    a = step(a, input, 1 / 60); b = step(b, input, 1 / 60)
    assert.deepEqual({ ...a, level: null }, { ...b, level: null })
  }
})
