import test from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../logic.js'
test('recording round trips mixed repeated controls, empty runs and signed seeds', () => {
  const rng = L.mulberry32(64)
  for (const seed of [0, 3, -12, 123456, Number.MAX_SAFE_INTEGER]) {
    const inputs = Array.from({ length: 5000 }, () => ({ pitch: Math.floor(rng() * 3) - 1, throttle: Math.floor(rng() * 3) - 1 }))
    const before = structuredClone(inputs)
    const encoded = L.encodeRun(seed, inputs)
    assert.match(encoded, /^[A-Za-z0-9_-]+$/)
    assert.deepEqual(L.decodeRun(encoded), { seed, inputs })
    assert.deepEqual(inputs, before)
    assert.deepEqual(L.decodeRun(L.encodeRun(seed, [])), { seed, inputs: [] })
  }
})
test('all nine constant control pairs compress and expand to independent inputs', () => {
  for (const pitch of [-1, 0, 1]) for (const throttle of [-1, 0, 1]) {
    const inputs = Array.from({ length: 3600 }, () => ({ pitch, throttle }))
    const encoded = L.encodeRun(123456, inputs)
    assert.ok(encoded.length < 40)
    const decoded = L.decodeRun(encoded)
    assert.deepEqual(decoded.inputs, inputs)
    decoded.inputs[0].pitch = 99
    assert.equal(decoded.inputs[1].pitch, pitch)
  }
})
test('replay equals the full immutable step fold including terminal inputs', () => {
  for (const dt of [1 / 60, 1 / 120]) {
    const inputs = Array.from({ length: 600 }, (_, i) => ({ pitch: i < 60 ? 0 : -1, throttle: i < 30 ? 1 : 0 }))
    const before = structuredClone(inputs)
    const expected = inputs.reduce((s, input) => L.step(s, input, dt), L.initialState(L.makeLevel(3)))
    assert.deepEqual(L.replay(3, inputs, dt), expected)
    assert.deepEqual(inputs, before)
  }
  assert.deepEqual(L.replay(4, [], 1 / 60), L.initialState(L.makeLevel(4)))
})
test('run codec rejects malformed controls and unsafe encoded lengths', () => {
  for (const inputs of [[{ pitch: 2, throttle: 0 }], [{ pitch: 0 }], [null]])
    assert.throws(() => L.encodeRun(3, inputs), /run/)
  for (const seed of [NaN, Infinity, 1.2]) assert.throws(() => L.encodeRun(seed, []), /run/)
  for (const str of ['', '???', '9_3_', '1_3_90', '1_3_40', '1_3_4zzzzzzzzzzzzzz', '1_3_41_'])
    assert.throws(() => L.decodeRun(str), /run/)
})
