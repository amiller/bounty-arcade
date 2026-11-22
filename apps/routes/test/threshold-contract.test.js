import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseGpx, stats } from '../logic.js'
const track = elevations => elevations.map((ele, i) => ({ lat: 0, lon: i / 1000, ele }))
const totals = (elevations, threshold) => {
  const { gain, loss } = stats(track(elevations), { threshold })
  return [gain, loss]
}
test('subthreshold oscillation never accumulates into phantom ascent', () => {
  assert.deepEqual(totals([100, 101, 100, 101, 100], 2), [0, 0])
  assert.deepEqual(totals([100, 99, 100, 99, 100], 2), [0, 0])
})
test('confirmed trends extend by each new extreme and ignore small reversals', () => {
  assert.deepEqual(totals([100, 101, 100, 105, 104, 110], 2), [10, 0])
  assert.deepEqual(totals([200, 190, 191, 180], 3), [0, 20])
  assert.deepEqual(totals([100, 103, 104, 103.5], 2), [4, 0])
})
test('reversal triggers at exact threshold and uses the extreme, not previous sample', () => {
  assert.deepEqual(totals([100, 103, 104, 103, 102], 2), [4, 2])
  assert.deepEqual(totals([100, 96, 97, 98, 99, 98.5, 101], 2), [5, 4])
})
test('fractional thresholds and repeated reversals maintain confirmed totals', () => {
  assert.deepEqual(totals([0, 0.25, 0, 1, 0.75, 0.5, 0.25, 0.5, 1], 0.5), [1.75, 0.75])
})
test('both original samples retain default metrics; filtering changes only gain/loss', () => {
  for (const name of ['alpine-climb', 'riverside-loop']) {
    const points = parseGpx(readFileSync(new URL('../samples/' + name + '.gpx', import.meta.url), 'utf8')).points
    const snapshot = structuredClone(points)
    const raw = stats(points)
    assert.deepEqual(stats(points, { threshold: 0 }), raw)
    const filtered = stats(points, { threshold: 1 })
    const { gain, loss, ...unchanged } = filtered
    const { gain: rawGain, loss: rawLoss, ...old } = raw
    assert.deepEqual(unchanged, old)
    assert.deepEqual(points, snapshot)
    if (name === 'riverside-loop') {
      assert.ok(Math.abs(rawGain - 52.6) < 0.1)
      assert.ok(gain < 50)
      assert.ok(Math.abs(gain - loss) < 1)
    }
  }
})
test('missing elevations retain legacy bridging and no-elevation totals', () => {
  assert.deepEqual(totals([100, null, 101, null, 100], 2), [0, 0])
  assert.deepEqual(totals([null, null], 2), [0, 0])
  assert.deepEqual(totals([123], 2), [0, 0])
})
test('invalid thresholds are rejected rather than producing misleading totals', () => {
  for (const threshold of [-1, NaN, Infinity, '2', null])
    assert.throws(() => stats(track([100, 110]), { threshold }), /threshold/)
})
