import { test, expect } from '@playwright/test'
import { makeLevel } from '../logic.js'

test('wind HUD follows the seed and survives restart and reload', async ({ page }) => {
  await page.goto('/apps/flight/')
  for (const seed of [1, 7, 42, 7]) {
    await page.getByTestId('seed').fill(String(seed))
    await page.getByTestId('restart').click()
    await expect(page.getByTestId('wind')).toHaveText(`${Math.round(makeLevel(seed).wind)} m/s`)
  }
  await page.reload()
  const seed = Number(await page.getByTestId('seed').inputValue())
  await expect(page.getByTestId('wind')).toHaveText(`${Math.round(makeLevel(seed).wind)} m/s`)
})

test('headwind and tailwind show different ground speeds after ten seconds', async ({ page }) => {
  const seeds = Array.from({ length: 100 }, (_, i) => i + 1)
  const head = seeds.find(s => makeLevel(s).wind < -10)
  const tail = seeds.find(s => makeLevel(s).wind > 10)
  expect(head).toBeDefined(); expect(tail).toBeDefined()
  await page.clock.install()
  await page.goto('/apps/flight/')
  const speeds = []
  for (const seed of [head, tail]) {
    await page.getByTestId('seed').fill(String(seed))
    await page.getByTestId('restart').click()
    await page.clock.runFor(10000)
    speeds.push(Number(await page.getByTestId('speed').textContent()))
  }
  expect(speeds[1] - speeds[0]).toBeGreaterThan(19)
})
