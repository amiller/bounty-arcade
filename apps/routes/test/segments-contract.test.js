import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseGpx, stats, haversine } from '../logic.js'
const p = (lat, lon, ele = null) => ({ lat, lon, ele })
const xml = segments => '<gpx><trk>' + segments.map(s => '<trkseg>' + s.map(x => '<trkpt lat="' + x.lat + '" lon="' + x.lon + '">' + (x.ele === null ? '' : '<ele>' + x.ele + '</ele>') + '</trkpt>').join('') + '</trkseg>').join('') + '</trk></gpx>'
const segments = () => [[p(0, 0, 100), p(0, .01, 110)], [p(10, 10, 500), p(10, 10.01, 490), p(10, 10.02, 490)]]
test('parser preserves segment boundaries and flattened order', () => {
  const source = segments(), parsed = parseGpx(xml(source))
  assert.deepEqual(parsed.segments, source)
  assert.deepEqual(parsed.points, source.flat())
})
test('distance, gain and loss exclude jumps between segments without mutation', () => {
  const ss = segments(), points = ss.flat(), before = structuredClone(ss)
  const s = stats(points, { segments: ss })
  const distance = ss.reduce((n, part) => n + part.slice(1).reduce((v, x, i) => v + haversine(part[i], x), 0), 0)
  assert(Math.abs(s.distance - distance) < 1e-6)
  assert.equal(s.gain, 10); assert.equal(s.loss, 10)
  assert.equal(s.count, 5); assert.equal(s.minEle, 100); assert.equal(s.maxEle, 500)
  assert.deepEqual(ss, before)
})
test('empty and singleton segments add no gap distance or gain', () => {
  const ss = [[], [p(0, 0, 10)], [], [p(20, 20, 999)], []]
  const parsed = parseGpx(xml(ss))
  assert.deepEqual(parsed.segments.map(s => s.length), [0, 1, 0, 1, 0])
  const s = stats(parsed.points, { segments: parsed.segments })
  assert.equal(s.distance, 0); assert.equal(s.gain, 0); assert.equal(s.loss, 0)
})
test('each bundled sample keeps its original full statistics and one segment', () => {
  for (const [name, distance] of [['alpine-climb.gpx', 4020.8], ['riverside-loop.gpx', 9105.4]]) {
    const g = parseGpx(readFileSync(new URL('../samples/' + name, import.meta.url), 'utf8'))
    assert.equal(g.segments.length, 1)
    assert.deepEqual(stats(g.points, { segments: g.segments }), stats(g.points))
    assert(Math.abs(stats(g.points, { segments: g.segments }).distance - distance) < 1)
  }
})
test('legacy unsegmented point input is one segment and default stats still connects points', () => {
  const g = parseGpx('<gpx><trkpt lat="0" lon="0"/><trkpt lat="1" lon="1"/></gpx>')
  assert.deepEqual(g.segments, [g.points])
  const ss = segments(), points = ss.flat()
  assert(stats(points).distance > stats(points, { segments: ss }).distance + 100000)
})
test('missing elevations retain old within-segment semantics without crossing gaps', () => {
  const ss = [[p(0, 0, 10), p(0, .01), p(0, .02, 30)], [p(1, 1), p(1, 1.01, 500)]]
  const s = stats(ss.flat(), { segments: ss })
  assert.equal(s.gain, 20); assert.equal(s.loss, 0)
})
