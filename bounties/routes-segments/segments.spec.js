import { test, expect } from '@playwright/test'

test('routes draws each segment as its own polyline', async ({ page }) => {
  await page.goto('/apps/routes/')
  await expect(page.getByTestId('stat-distance')).toHaveText('4.02 km')
  const gpx = '<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.01"/></trkseg><trkseg><trkpt lat="0.01" lon="0.01"/><trkpt lat="0.01" lon="0.02"/><trkpt lat="0.02" lon="0.02"/></trkseg></trk></gpx>'
  await page.getByTestId('file').setInputFiles({ name: 'gap.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) })
  await expect(page.locator('#route-name')).toHaveText('gap')
  await expect(page.locator('#track polyline')).toHaveCount(2)
  await expect(page.getByTestId('stat-distance')).toHaveText('3.34 km')
})
