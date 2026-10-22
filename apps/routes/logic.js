export const EARTH_RADIUS_M = 6371000
const rad = d => d * Math.PI / 180

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`))
  if (!m) throw new Error(`trkpt missing ${name}: ${tag}`)
  return Number(m[1])
}

export function parseGpx(text) {
  const points = []
  for (const m of text.matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g)) {
    const ele = m[2]?.match(/<ele>\s*([^<]+?)\s*<\/ele>/)
    const p = { lat: attr(m[1], 'lat'), lon: attr(m[1], 'lon'), ele: ele ? Number(ele[1]) : null }
    if (![p.lat, p.lon].every(Number.isFinite) || (p.ele !== null && !Number.isFinite(p.ele))) throw new Error(`bad trkpt: ${m[0]}`)
    points.push(p)
  }
  if (!points.length) throw new Error('no <trkpt> elements in GPX')
  const name = text.match(/<trk>[\s\S]*?<name>([^<]*)<\/name>/)?.[1].trim() ?? null
  return { name, points }
}

export function haversine(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function profile(points) {
  let d = 0
  return points.map((p, i) => ({ d: d += i ? haversine(points[i - 1], p) : 0, ele: p.ele }))
}

// Hysteresis: a climb or descent only counts once elevation has moved `threshold`
// from the last counted turning point, and then keeps extending until it reverses
// by `threshold` from the extreme.
function elevationChange(eles, threshold) {
  if (eles.length < 2) return { gain: 0, loss: 0 }
  let gain = 0, loss = 0, anchor = eles[0], extreme = eles[0], mode = null
  const close = () => {
    if (mode === 'up') gain += extreme - anchor
    else if (mode === 'down') loss += anchor - extreme
    anchor = extreme
    mode = null
  }
  for (const ele of eles.slice(1)) {
    if (mode === 'up' && ele > extreme) extreme = ele
    else if (mode === 'down' && ele < extreme) extreme = ele
    if (mode === 'up' && ele <= extreme - threshold) { close(); extreme = ele }
    else if (mode === 'down' && ele >= extreme + threshold) { close(); extreme = ele }
    if (mode === null) {
      if (ele >= anchor + threshold) { mode = 'up'; extreme = ele }
      else if (ele <= anchor - threshold) { mode = 'down'; extreme = ele }
    }
  }
  if (mode !== null) close()
  return { gain, loss }
}

export function stats(points, { segments = [points], threshold = 0 } = {}) {
  const segs = segments && segments.length ? segments : [points]
  let distance = 0, gain = 0, loss = 0
  for (const seg of segs) {
    for (let i = 1; i < seg.length; i++) distance += haversine(seg[i - 1], seg[i])
    const { gain: g, loss: l } = elevationChange(seg.map(p => p.ele).filter(e => e !== null), threshold)
    gain += g
    loss += l
  }
  const eles = points.map(p => p.ele).filter(e => e !== null)
  const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
  return {
    count: points.length,
    distance, gain, loss,
    minEle: eles.length ? Math.min(...eles) : null,
    maxEle: eles.length ? Math.max(...eles) : null,
    bbox: { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) },
  }
}

// Equirectangular projection scaled to fit width x height (minus pad), aspect preserved, north up.
export function project(points, width, height, pad = 0) {
  const { bbox } = stats(points)
  const k = Math.cos(rad((bbox.minLat + bbox.maxLat) / 2))
  const spanX = (bbox.maxLon - bbox.minLon) * k, spanY = bbox.maxLat - bbox.minLat
  const s = Math.min((width - 2 * pad) / (spanX || 1), (height - 2 * pad) / (spanY || 1))
  const ox = (width - spanX * s) / 2, oy = (height - spanY * s) / 2
  return points.map(p => [ox + (p.lon - bbox.minLon) * k * s, oy + (bbox.maxLat - p.lat) * s])
}

// Maps profile samples with elevation to SVG coords: x by distance, y by elevation (higher = smaller y).
export function profileCoords(prof, width, height, pad = 0) {
  const pts = prof.filter(p => p.ele !== null)
  const eles = pts.map(p => p.ele), lo = Math.min(...eles), span = Math.max(...eles) - lo || 1
  const dist = prof.at(-1).d || 1
  return pts.map(p => [pad + p.d / dist * (width - 2 * pad), height - pad - (p.ele - lo) / span * (height - 2 * pad)])
}

export const formatKm = m => `${(m / 1000).toFixed(2)} km`
export const formatM = m => m === null ? '—' : `${Math.round(m)} m`
