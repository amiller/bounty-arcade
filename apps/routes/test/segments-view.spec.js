import { test, expect } from '@playwright/test'
import { project } from '../logic.js'
const segments = [[{lat: 0, lon: 0, ele: 100}, {lat: 0, lon: .01, ele: 110}], [{lat: .01, lon: .01, ele: 500}, {lat: .01, lon: .02, ele: 490}, {lat: .02, lon: .02, ele: 490}]]
const gpx = '<gpx><trk>' + segments.map(s => '<trkseg>' + s.map(p => '<trkpt lat="' + p.lat + '" lon="' + p.lon + '"><ele>' + p.ele + '</ele></trkpt>').join('') + '</trkseg>').join('') + '</trk></gpx>'
test('multi-segment upload skips gaps in distance and elevation and draws separate shared-scale paths', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/apps/routes/')
  await expect(page.getByTestId('stat-distance')).toHaveText('4.02 km')
  await page.getByTestId('file').setInputFiles({name: 'segments.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx)})
  await expect(page.getByTestId('stat-distance')).toHaveText('3.34 km')
  await expect(page.getByTestId('stat-gain')).toHaveText('10 m')
  await expect(page.getByTestId('stat-loss')).toHaveText('10 m')
  await expect(page.getByTestId('stat-count')).toHaveText('5')
  const lines = page.locator('#track polyline')
  await expect(lines).toHaveCount(2)
  const projected = project(segments.flat(), 600, 400, 20)
  const text = pts => pts.map(([x,y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ')
  await expect(lines.nth(0)).toHaveAttribute('points', text(projected.slice(0,2)))
  await expect(lines.nth(1)).toHaveAttribute('points', text(projected.slice(2)))
  await page.getByTestId('sample').selectOption('samples/riverside-loop.gpx')
  await expect(page.getByTestId('stat-distance')).toHaveText('9.11 km')
  await expect(lines).toHaveCount(1)
  await page.getByTestId('sample').selectOption('samples/alpine-climb.gpx')
  await expect(page.getByTestId('stat-distance')).toHaveText('4.02 km')
  await expect(page.getByTestId('stat-gain')).toHaveText('865 m')
  await expect(lines).toHaveCount(1)
  expect(errors).toEqual([])
})
