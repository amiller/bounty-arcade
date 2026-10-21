import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseGpx, haversine, stats, profile, formatKm } from '../../apps/routes/logic.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const trkpt = ([lat, lon, ele]) => ele === undefined ? `<trkpt lat="${lat}" lon="${lon}"/>` : `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`
const gpx = segs => `<gpx><trk><name>Gap</name>${segs.map(s => `<trkseg>${s.map(trkpt).join('')}</trkseg>`).join('')}</trk></gpx>`
const sample = f => parseGpx(readFileSync(new URL(`../../apps/routes/samples/${f}`, import.meta.url), 'utf8'))

test('parses two segments', () => {
  const g = parseGpx(gpx([[[0, 0], [0, 0.01]], [[10, 10], [10, 10.01], [10, 10.02]]]))
  assert.equal(g.segments.length, 2)
  assert.deepEqual(g.segments.map(s => s.length), [2, 3])
  assert.equal(g.points.length, 5)
  assert.deepEqual(g.points, g.segments.flat())
  assert.equal(g.name, 'Gap')
})

test('distance skips gaps', () => {
  const { points, segments } = parseGpx(gpx([[[0, 0], [0, 0.01]], [[10, 10], [10, 10.01]]]))
  const expected = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }) + haversine({ lat: 10, lon: 10 }, { lat: 10, lon: 10.01 })
  near(stats(points, { segments }).distance, expected, 1)
  assert.ok(stats(points).distance > 1e6, 'flat stats still crosses the gap')
})

test('gain skips gaps', () => {
  const { points, segments } = parseGpx(gpx([[[0, 0, 100], [0, 0.01, 110]], [[1, 1, 500], [1, 1.01, 490]]]))
  const s = stats(points, { segments })
  assert.equal(s.gain, 10)
  assert.equal(s.loss, 10)
})

test('samples unchanged', () => {
  for (const [f, d] of [['alpine-climb.gpx', 4020.8], ['riverside-loop.gpx', 9105.4]]) {
    const { points, segments } = sample(f)
    assert.equal(segments.length, 1)
    near(stats(points, { segments }).distance, d, 1)
    near(stats(points, { segments }).distance, stats(points).distance, 1e-9)
  }
})

test('browser example distance and profile alignment', () => {
  const { points, segments } = parseGpx(gpx([[[0, 0], [0, 0.01]], [[0.01, 0.01], [0.01, 0.02], [0.02, 0.02]]]))
  assert.equal(formatKm(stats(points, { segments }).distance), '3.34 km')
  assert.equal(formatKm(stats(points).distance), '4.45 km')
  const p = profile(points, segments)
  assert.equal(p.length, points.length)
  assert.equal(p[2].d, p[1].d)
  near(p.at(-1).d, stats(points, { segments }).distance, 1e-9)
})

test('GPX without trkseg is one segment; empty segments are dropped', () => {
  assert.deepEqual(parseGpx('<trkpt lat="1" lon="2"/><trkpt lat="3" lon="4"/>').segments.map(s => s.length), [2])
  assert.deepEqual(parseGpx(`<trkseg></trkseg><trkseg/>${gpx([[[1, 2]]])}`).segments.map(s => s.length), [1])
  assert.throws(() => parseGpx('<trk><trkseg></trkseg></trk>'), /no <trkpt>/)
})
