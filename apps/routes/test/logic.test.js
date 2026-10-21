import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseGpx, haversine, profile, stats, timing, project, profileCoords, formatKm, formatM, formatDuration, formatSpeed, EARTH_RADIUS_M } from '../logic.js'

const sample = f => parseGpx(readFileSync(new URL(`../samples/${f}`, import.meta.url), 'utf8'))
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const track = eles => eles.map((ele, i) => ({ lat: 0, lon: i * 0.001, ele }))

test('parses alpine sample', () => {
  const g = sample('alpine-climb.gpx')
  assert.equal(g.name, 'Alpine Switchback Climb')
  assert.equal(g.points.length, 220)
  assert.deepEqual(g.points[0], { lat: 45.9237, lon: 6.869448, ele: 1034.6 })
})

test('parses riverside sample as a closed loop', () => {
  const g = sample('riverside-loop.gpx')
  assert.equal(g.name, 'Riverside Loop')
  assert.equal(g.points.length, 301)
  assert.deepEqual(g.points.at(-1), g.points[0])
})

test('parses self-closing trkpt, single quotes and missing ele', () => {
  const g = parseGpx(`<gpx><trk><trkseg><trkpt lon='2' lat='1'/><trkpt lat="3" lon="4"><ele> 5.5 </ele></trkpt></trkseg></trk></gpx>`)
  assert.equal(g.name, null)
  assert.deepEqual(g.points, [{ lat: 1, lon: 2, ele: null }, { lat: 3, lon: 4, ele: 5.5 }])
})

test('rejects GPX without points or with bad coordinates', () => {
  assert.throws(() => parseGpx('<gpx></gpx>'), /no <trkpt>/)
  assert.throws(() => parseGpx('<trkpt lat="1"/>'), /missing lon/)
  assert.throws(() => parseGpx('<trkpt lat="x" lon="1"/>'), /bad trkpt/)
})

test('haversine matches known distances', () => {
  near(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), EARTH_RADIUS_M * Math.PI / 180, 1e-6)
  near(haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }), EARTH_RADIUS_M * Math.PI, 1e-6)
  near(haversine({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 }), 343_560, 500)
  assert.equal(haversine({ lat: 10, lon: 10 }, { lat: 10, lon: 10 }), 0)
})

test('sample distances', () => {
  near(stats(sample('alpine-climb.gpx').points).distance, 4020.8, 1)
  near(stats(sample('riverside-loop.gpx').points).distance, 9105.4, 1)
})

test('gain and loss on synthetic tracks', () => {
  assert.deepEqual([stats(track([100, 150, 120, 200])).gain, stats(track([100, 150, 120, 200])).loss], [130, 30])
  const flat = stats(track([5, 5, 5]))
  assert.equal(flat.gain, 0)
  assert.equal(flat.loss, 0)
  const s = stats(track([10, null, 30, 20]))
  assert.equal(s.gain, 20)
  assert.equal(s.loss, 10)
  const none = stats(track([null, null]))
  assert.deepEqual([none.gain, none.minEle, none.maxEle], [0, null, null])
})

test('sample elevation stats and bbox', () => {
  const s = stats(sample('riverside-loop.gpx').points)
  near(s.gain, s.loss, 1e-9)
  assert.equal(s.minEle, 11.7)
  assert.equal(s.maxEle, 20.2)
  assert.deepEqual(s.bbox, { minLat: 51.4672, maxLat: 51.4928, minLon: -0.242, maxLon: -0.198 })
  near(stats(sample('alpine-climb.gpx').points).gain, 865.1, 1e-9)
})

test('profile is cumulative distance', () => {
  const p = profile(track([1, 2, 3]))
  assert.equal(p[0].d, 0)
  near(p[2].d, 2 * p[1].d, 1e-9)
  assert.deepEqual(p.map(x => x.ele), [1, 2, 3])
})

test('project fits box, preserves aspect, north up', () => {
  const xy = project([{ lat: 0, lon: 0 }, { lat: 1, lon: 2 }], 300, 300, 10)
  assert.deepEqual(xy.map(pt => pt.map(Math.round)), [[10, 220], [290, 80]])
  const v = project([{ lat: 60, lon: 0 }, { lat: 61, lon: 0 }], 100, 100)
  assert.deepEqual(v, [[50, 100], [50, 0]])
})

test('profileCoords spans the box', () => {
  const c = profileCoords(profile(track([0, 50, 100])), 200, 100, 0)
  assert.deepEqual(c.map(([x]) => Math.round(x)), [0, 100, 200])
  assert.deepEqual(c.map(([, y]) => y), [100, 50, 0])
})

test('formatting', () => {
  assert.equal(formatKm(4020.83), '4.02 km')
  assert.equal(formatM(865.1), '865 m')
  assert.equal(formatM(null), '—')
})

test('parses point times, including offsets, and rejects bad ones', () => {
  const g = parseGpx(`<gpx><trk><trkseg><trkpt lat="1" lon="2"><ele>3</ele><time> 2026-01-01T01:00:00+01:00 </time></trkpt><trkpt lat="1" lon="2"/></trkseg></trk></gpx>`)
  assert.deepEqual(g.points, [{ lat: 1, lon: 2, ele: 3, time: Date.UTC(2026, 0, 1) }, { lat: 1, lon: 2, ele: null }])
  assert.equal('time' in sample('alpine-climb.gpx').points[0], false)
  assert.throws(() => parseGpx('<trkpt lat="1" lon="2"><time>soon</time></trkpt>'), /bad trkpt/)
})

test('timing counts only intervals at walking speed or faster', () => {
  const step = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 })
  const at = (lon, time) => ({ lat: 0, lon, ele: null, time })
  const slow = 120000 + step / 0.4 * 1000
  const t = timing([at(0, 0), at(0.001, 60000), at(0.001, 120000), at(0.002, slow), at(0.003, slow + 60000)])
  near(t.elapsed, slow + 60000, 1e-6)
  near(t.moving, 120000, 1e-6)
  near(t.avgSpeed, 3 * step / 120, 1e-6)
  const fast = timing([at(0, 0), at(0.001, step / 0.6 * 1000)])
  near(fast.moving, step / 0.6 * 1000, 1e-6)
  assert.deepEqual(timing([at(0, 0), at(0, 0), at(0, 5000)]), { elapsed: 5000, moving: 0, avgSpeed: null })
  assert.deepEqual(timing([]), { elapsed: null, moving: null, avgSpeed: null })
  assert.deepEqual(timing(sample('riverside-loop.gpx').points), { elapsed: null, moving: null, avgSpeed: null })
})

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00:00')
  assert.equal(formatDuration(120000), '0:02:00')
  assert.equal(formatDuration(3723000), '1:02:03')
  assert.equal(formatDuration(59999), '0:01:00')
  assert.equal(formatDuration(36000000), '10:00:00')
  assert.equal(formatDuration(null), '—')
})

test('formatSpeed', () => {
  assert.equal(formatSpeed(0.5), '1.8 km/h')
  assert.equal(formatSpeed(10), '36.0 km/h')
  assert.equal(formatSpeed(null), '—')
  const step = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 })
  const at = (lon, time) => ({ lat: 0, lon, ele: null, time })
  assert.equal(formatSpeed(timing([at(0, 0), at(0.001, 60000), at(0.001, 120000)]).avgSpeed), `${(step / 60 * 3.6).toFixed(1)} km/h`)
})
