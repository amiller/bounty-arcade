import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseGpx, haversine, stats } from '../../apps/routes/logic.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const pt = (lat, lon, ele = null) => ({ lat, lon, ele })
const segStats = segments => stats(segments.flat(), { segments })
const sample = f => parseGpx(readFileSync(new URL(`../../apps/routes/samples/${f}`, import.meta.url), 'utf8'))
const trkpt = ([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`
const gpx = segs => `<gpx><trk>${segs.map(s => `<trkseg>${s.map(trkpt).join('')}</trkseg>`).join('')}</trk></gpx>`

test('parses two segments', () => {
  const g = parseGpx(gpx([[[0, 0], [0, 1]], [[1, 0], [1, 1], [1, 2]]]))
  assert.equal(g.segments.length, 2)
  assert.deepEqual(g.segments.map(s => s.length), [2, 3])
  assert.equal(g.points.length, 5)
})

test('distance skips gaps', () => {
  const a = [pt(0, 0), pt(0, 0.01)], b = [pt(10, 10), pt(10, 10.01)]
  near(segStats([a, b]).distance, haversine(...a) + haversine(...b), 1)
})

test('gain skips gaps', () => {
  const s = segStats([[pt(0, 0, 100), pt(0, 0.001, 110)], [pt(0, 0.002, 500), pt(0, 0.003, 490)]])
  assert.equal(s.gain, 10)
  assert.equal(s.loss, 10)
})

test('samples unchanged', () => {
  for (const [f, d] of [['alpine-climb.gpx', 4020.8], ['riverside-loop.gpx', 9105.4]]) {
    const g = sample(f)
    assert.equal(g.segments.length, 1)
    near(stats(g.points, { segments: g.segments }).distance, d, 1)
  }
})
