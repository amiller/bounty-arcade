import { test, expect } from '@playwright/test'

const timedGpx = `<gpx><trk><name>Walk and stop</name><trkseg>
  <trkpt lat="0" lon="0"><time>2026-01-01T00:00:00Z</time></trkpt>
  <trkpt lat="0" lon="0.001"><time>2026-01-01T00:01:00Z</time></trkpt>
  <trkpt lat="0" lon="0.001"><time>2026-01-01T00:02:00Z</time></trkpt>
</trkseg></trk></gpx>`

test('route timing follows uploads and clears when returning to an untimed sample', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/apps/routes/')
  await expect(page.getByTestId('stat-distance')).toHaveText('4.02 km')
  await expect(page.getByTestId('stat-elapsed')).toHaveText('—')
  await expect(page.getByTestId('stat-moving')).toHaveText('—')
  await page.getByTestId('file').setInputFiles({ name: 'timed.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(timedGpx) })
  await expect(page.locator('#route-name')).toHaveText('Walk and stop')
  await expect(page.getByTestId('stat-elapsed')).toHaveText('0:02:00')
  await expect(page.getByTestId('stat-moving')).toHaveText('0:01:00')
  await page.getByTestId('sample').selectOption('samples/riverside-loop.gpx')
  await expect(page.getByTestId('stat-distance')).toHaveText('9.11 km')
  await expect(page.getByTestId('stat-elapsed')).toHaveText('—')
  await expect(page.getByTestId('stat-moving')).toHaveText('—')
  expect(errors).toEqual([])
})

test('an upload missing one timestamp clears both timing values', async ({ page }) => {
  await page.goto('/apps/routes/')
  await expect(page.getByTestId('stat-distance')).toHaveText('4.02 km')
  await page.getByTestId('file').setInputFiles({ name: 'timed.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(timedGpx) })
  await expect(page.getByTestId('stat-moving')).toHaveText('0:01:00')
  const partial = timedGpx.replace('<time>2026-01-01T00:01:00Z</time>', '').replace('Walk and stop', 'Partial timing')
  await page.getByTestId('file').setInputFiles({ name: 'partial.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(partial) })
  await expect(page.locator('#route-name')).toHaveText('Partial timing')
  await expect(page.getByTestId('stat-elapsed')).toHaveText('—')
  await expect(page.getByTestId('stat-moving')).toHaveText('—')
})
