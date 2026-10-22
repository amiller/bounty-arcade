import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as logic from '../logic.js'

const point = (lon, time) => ({ lat: 0, lon, ele: null, time })
const absent = { elapsed: null, moving: null, avgSpeed: null }

test('timestamps are milliseconds and absent timestamps preserve the original point shape', () => {
  const { points } = logic.parseGpx(`<gpx><trk><trkseg>
    <trkpt lat="0" lon="0"><time> 2026-01-01T01:00:00+01:00 </time></trkpt>
    <trkpt lat="0" lon="1"/>
    <trkpt lat="0" lon="2"><ele>12</ele></trkpt>
  </trkseg></trk></gpx>`)
  assert.equal(points[0].time, Date.UTC(2026, 0, 1))
  assert.deepEqual(points.slice(1), [{ lat: 0, lon: 1, ele: null }, { lat: 0, lon: 2, ele: 12 }])
})

test('invalid present timestamps are rejected instead of becoming NaN', () => {
  assert.throws(() => logic.parseGpx('<trkpt lat="0" lon="0"><time>not a date</time></trkpt>'), /bad trkpt/)
})

test('timing distinguishes elapsed duration from moving duration and uses total distance', () => {
  const points = [point(0, 0), point(0.001, 60000), point(0.0011, 120000), point(0.0011, 600000)]
  const original = structuredClone(points)
  const actual = logic.timing(points)
  assert.equal(actual.elapsed, 600000)
  assert.equal(actual.moving, 60000)
  const total = logic.haversine(points[0], points[1]) + logic.haversine(points[1], points[2])
  assert.ok(Math.abs(actual.avgSpeed - total / 60) < 1e-9)
  assert.deepEqual(points, original)
})

test('the moving-speed threshold includes exactly 0.5 metres per second', () => {
  const points = [point(0, 0), point(0.001, 0)]
  points[1].time = logic.haversine(points[0], points[1]) / 0.5 * 1000
  const actual = logic.timing(points)
  assert.equal(actual.moving, points[1].time)
  assert.ok(Math.abs(actual.avgSpeed - 0.5) < 1e-12)
})

test('missing or invalid timestamps never produce partial timing statistics', () => {
  assert.deepEqual(logic.timing([point(0, 0), { lat: 0, lon: 1, ele: null }]), absent)
  for (const time of [null, undefined, NaN, Infinity, '60000']) {
    assert.deepEqual(logic.timing([point(0, 0), point(0.001, time)]), absent)
  }
})

test('empty, stationary and single-point tracks avoid infinite average speeds', () => {
  assert.deepEqual(logic.timing([]), absent)
  assert.deepEqual(logic.timing([point(0, 0)]), { elapsed: 0, moving: 0, avgSpeed: null })
  assert.deepEqual(logic.timing([point(0, 0), point(0, 60000)]), { elapsed: 60000, moving: 0, avgSpeed: null })
  assert.deepEqual(logic.timing([point(0, 0), point(0, 0)]), { elapsed: 0, moving: 0, avgSpeed: null })
})

test('backward time and instantaneous displacement do not report a valid speed', () => {
  assert.deepEqual(logic.timing([point(0, 60000), point(0.001, 0)]), absent)
  assert.deepEqual(logic.timing([point(0, 0), point(0.001, 0)]), absent)
})

test('duration formatting keeps hours, pads minutes and seconds and drops partial seconds', () => {
  assert.equal(logic.formatDuration(3723000), '1:02:03')
  assert.equal(logic.formatDuration(90061000), '25:01:01')
  assert.equal(logic.formatDuration(60999), '0:01:00')
  assert.equal(logic.formatDuration(0), '0:00:00')
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(logic.formatDuration(value), '—')
})

test('bundled untimed samples keep their original parse shape and absent timing', () => {
  for (const name of ['alpine-climb', 'riverside-loop']) {
    const { points } = logic.parseGpx(readFileSync(new URL(`../samples/${name}.gpx`, import.meta.url), 'utf8'))
    assert.equal(points.some(p => 'time' in p), false)
    assert.deepEqual(logic.timing(points), absent)
  }
})
