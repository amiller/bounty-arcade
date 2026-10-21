import { test, expect } from '@playwright/test'

const seg = pts => `<trkseg>${pts.map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg>`
const gpx = `<gpx><trk><name>Gap</name>${seg([[0, 0], [0, 0.01]])}${seg([[0.01, 0.01], [0.01, 0.02], [0.02, 0.02]])}</trk></gpx>`

test('each segment is its own polyline and the gap adds no distance', async ({ page }) => {
  await page.goto('/apps/routes/')
  await expect(page.locator('#track polyline')).toHaveCount(1)
  await expect(page.getByTestId('stat-distance')).not.toBeEmpty()
  await page.locator('#file').setInputFiles({ name: 'gap.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) })
  await expect(page.locator('#track polyline')).toHaveCount(2)
  await expect(page.locator('#stat-distance')).toHaveText('3.34 km')
  await expect(page.locator('#track circle')).toHaveCount(2)
})
