import test from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../logic.js'

const DT = 1 / 60
const flat = () => ({ spacing: 10, terrain: [0, 0], gates: [] })
const cruise = () => L.initialState(flat(), { y: 2000 })
const run = (state, input, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) state = L.step(state, input, DT)
  return state
}

test('a fresh flight starts with a full tank and exports the specified burn rate', () => {
  assert.equal(cruise().fuel, 1)
  assert.equal(L.BURN, 1 / 90)
})

test('fuel burns with throttle', () => {
  const state = run({ ...cruise(), throttle: 1 }, { throttle: 1 }, 45)
  assert.equal(state.status, 'flying')
  assert.ok(Math.abs(state.fuel - 0.5) < 1e-9, `fuel: ${state.fuel}`)
})

test('idle burns nothing', () => {
  const state = run({ ...cruise(), throttle: 0 }, {}, 30)
  assert.equal(state.status, 'flying')
  assert.equal(state.fuel, 1)
})

test('fuel never goes negative and the throttle setting is kept', () => {
  const state = run({ ...cruise(), throttle: 1 }, { throttle: 1 }, 200)
  assert.equal(state.status, 'flying')
  assert.equal(state.fuel, 0)
  assert.equal(state.throttle, 1)
})

test('empty tank glides while a fueled cruise holds altitude', () => {
  const empty = run({ ...cruise(), fuel: 0 }, {}, 60)
  const fueled = run(cruise(), {}, 60)
  assert.equal(empty.status, 'flying')
  assert.ok(empty.y < 1940, `empty altitude: ${empty.y}`)
  assert.ok(Math.abs(fueled.y - 2000) < 1e-6, `fueled altitude: ${fueled.y}`)
  assert.equal(empty.fuel, 0)
  assert.equal(empty.throttle, cruise().throttle)
})

test('an empty tank removes thrust without erasing the throttle setting', () => {
  const empty = { ...cruise(), fuel: 0, throttle: 1 }
  assert.deepEqual(L.forces(empty), L.forces({ ...empty, throttle: 0 }))
  assert.notDeepEqual(L.forces(empty), L.forces({ ...empty, fuel: 1 }))
  assert.equal(L.step(empty, {}, DT).throttle, 1)
})

test('thrust is cut on the step that depletes the tank', () => {
  const state = { ...cruise(), fuel: L.BURN * DT, throttle: 1 }
  const withoutThrust = L.forces({ ...state, throttle: 0 })
  const next = L.step(state, {}, DT)
  assert.equal(next.fuel, 0)
  assert.equal(next.throttle, 1)
  assert.equal(next.vx, state.vx + withoutThrust.ax * DT)
  assert.equal(next.vy, state.vy + withoutThrust.ay * DT)
})

test('seeded inputs give identical states including fuel', () => {
  const inputs = Array.from({ length: 1200 }, (_, i) => ({
    pitch: [0, 1, 0, -1][(i >> 6) % 4],
    throttle: i % 300 < 100 ? 1 : 0,
  }))
  const fly = () => inputs.reduce((state, input) => L.step(state, input, DT),
    L.initialState(L.makeLevel(99), { y: 2000 }))
  const state = fly()
  assert.deepEqual(state, fly())
  assert.ok(state.fuel >= 0 && state.fuel < 1)
})

test('fuel updates leave the input state unchanged and freeze after the flight ends', () => {
  const state = cruise()
  const next = L.step(state, {}, DT)
  assert.equal(state.fuel, 1)
  assert.ok(next.fuel < state.fuel)
  const crashed = { ...next, status: 'crashed' }
  assert.equal(L.step(crashed, { throttle: 1 }, DT), crashed)
})
