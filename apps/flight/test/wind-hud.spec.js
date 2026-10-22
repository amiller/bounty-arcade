import { test, expect } from '@playwright/test'

test('wind HUD matches seeded level values across restart and reload', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/apps/flight/')
  const wind = page.getByTestId('wind')
  await expect(wind).toHaveText(/^-?\d+ m\/s$/)
  for (const seed of [1, 7, 19, 41]) {
    const expected = await page.evaluate(async seed => {
      const { makeLevel } = await import('/apps/flight/logic.js')
      return `${Math.round(makeLevel(seed).wind)} m/s`
    }, seed)
    await page.getByTestId('seed').fill(String(seed))
    await page.getByTestId('restart').click()
    await expect(wind).toHaveText(expected)
    await page.getByTestId('restart').click()
    await expect(wind).toHaveText(expected)
  }
  await page.getByTestId('seed').fill('1')
  await page.getByTestId('restart').click()
  const expectedAfterReload = await page.evaluate(async () => {
    const { makeLevel } = await import('/apps/flight/logic.js')
    return `${Math.round(makeLevel(1).wind)} m/s`
  })
  await expect(wind).toHaveText(expectedAfterReload)
  await page.reload()
  await expect(wind).toHaveText(expectedAfterReload)
  expect(errors).toEqual([])
})

test('strong tailwind has higher ground speed than headwind after ten seconds', async ({ page }) => {
  await page.goto('/apps/flight/')
  const seeds = await page.evaluate(async () => {
    const { makeLevel } = await import('/apps/flight/logic.js')
    const values = Array.from({ length: 50 }, (_, index) => {
      const seed = index + 1
      return { seed, wind: makeLevel(seed).wind }
    })
    return [values.find(value => value.wind < -10), values.find(value => value.wind > 10)]
  })
  const speeds = []
  for (const selected of seeds) {
    expect(selected).toBeDefined()
    await page.getByTestId('seed').fill(String(selected.seed))
    await page.getByTestId('restart').click()
    await expect(page.getByTestId('wind')).toHaveText(`${Math.round(selected.wind)} m/s`)
    await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'flying')
    await page.waitForTimeout(10000)
    await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'flying')
    const speed = Number(await page.getByTestId('speed').textContent())
    expect(Math.abs(speed - (40 + selected.wind))).toBeLessThanOrEqual(1)
    speeds.push(speed)
  }
  expect(speeds[1] - speeds[0]).toBeGreaterThan(19)
})
