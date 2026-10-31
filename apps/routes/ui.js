import { parseGpx, stats, profile, project, profileCoords, formatKm, formatM } from './logic.js'

const $ = id => document.getElementById(id)
const NS = 'http://www.w3.org/2000/svg'
const pts = xy => xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function el(name, attrs, text) {
  const e = document.createElementNS(NS, name)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}

function drawTrack(points) {
  const xy = project(points, 600, 400, 20)
  $('track').replaceChildren(
    el('polyline', { points: pts(xy) }),
    el('circle', { class: 'start', cx: xy[0][0], cy: xy[0][1], r: 6 }),
    el('circle', { class: 'end', cx: xy.at(-1)[0], cy: xy.at(-1)[1], r: 4 }),
  )
}

function drawProfile(points, s) {
  const svg = $('profile')
  if (s.minEle === null) return svg.replaceChildren(el('text', { class: 'axis', x: 300, y: 85, 'text-anchor': 'middle' }, 'No elevation data'))
  const prof = profile(points), xy = profileCoords(prof, 600, 160, 16)
  svg.replaceChildren(
    el('polygon', { points: pts([[xy[0][0], 144], ...xy, [xy.at(-1)[0], 144]]) }),
    el('polyline', { points: pts(xy) }),
    el('text', { class: 'axis', x: 18, y: 12 }, formatM(s.maxEle)),
    el('text', { class: 'axis', x: 18, y: 158 }, formatM(s.minEle)),
    el('text', { class: 'axis', x: 582, y: 158, 'text-anchor': 'end' }, formatKm(s.distance)),
  )
}

let currentPoints = null
let threshold = 0

function showStats(points) {
  const s = stats(points, { threshold })
  $('stat-distance').textContent = formatKm(s.distance)
  $('stat-gain').textContent = formatM(s.gain)
  $('stat-loss').textContent = formatM(s.loss)
  $('stat-min').textContent = formatM(s.minEle)
  $('stat-max').textContent = formatM(s.maxEle)
  $('stat-count').textContent = s.count
  return s
}

function show(text, label) {
  $('error').textContent = ''
  const { name, points } = parseGpx(text)
  currentPoints = points
  const s = showStats(points)
  $('route-name').textContent = name ?? label
  drawTrack(points)
  drawProfile(points, s)
}

$('threshold').addEventListener('input', () => {
  const input = $('threshold')
  const value = input.value === '' ? 0 : input.valueAsNumber
  if (input.validity.badInput || !Number.isFinite(value) || value < 0) {
    input.setCustomValidity('Enter a non-negative threshold in metres')
    return
  }
  input.setCustomValidity('')
  threshold = value
  if (currentPoints) showStats(currentPoints)
})

const report = e => { $('error').textContent = e.message; throw e }

async function loadSample() {
  const res = await fetch($('sample').value)
  if (!res.ok) throw new Error(`${res.status} fetching ${$('sample').value}`)
  show(await res.text(), $('sample').selectedOptions[0].text)
}

$('sample').addEventListener('change', () => loadSample().catch(report))
$('file').addEventListener('change', async () => {
  const f = $('file').files[0]
  await f.text().then(t => show(t, f.name.replace(/\.gpx$/i, ''))).catch(report)
})
loadSample().catch(report)
