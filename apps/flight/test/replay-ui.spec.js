import { test, expect } from '@playwright/test'
import { encodeRun, decodeRun, replay, terrainAt } from '../logic.js'
const hud = state => ({
  score: state.score + '/' + state.level.gates.length,
  speed: Math.hypot(state.vx, state.vy).toFixed(0),
  altitude: (state.y - terrainAt(state.level, state.x)).toFixed(0),
  throttle: Math.round(state.throttle * 100) + '%',
})
async function expectHud(page, expected) {
  for (const [name, value] of Object.entries(expected)) await expect(page.getByTestId(name)).toHaveText(value)
}
test('shared dive replays exact final HUD without controls and restart starts a fresh recording', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const inputs = Array.from({ length: 300 }, () => ({ pitch: -1, throttle: 0 }))
  await page.goto('/apps/flight/?run=' + encodeRun(3, inputs))
  await expect(page.getByTestId('seed')).toHaveValue('3')
  await expect(page.getByTestId('game')).toHaveAttribute('data-replay-complete', 'true', { timeout: 10000 })
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'crashed')
  await expectHud(page, hud(replay(3, inputs, 1 / 60)))
  const href = await page.getByTestId('share').getAttribute('href')
  expect(decodeRun(new URL(href, page.url()).searchParams.get('run'))).toEqual({ seed: 3, inputs })
  await page.getByTestId('restart').click()
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'flying')
  await expect(page.getByTestId('game')).toHaveAttribute('data-replay-complete', 'false')
  expect(new URL(page.url()).searchParams.has('run')).toBe(false)
  expect(errors).toEqual([])
})
test('a live keyboard run shares its precise crash HUD, including simultaneous key aliases', async ({ page }) => {
  await page.goto('/apps/flight/')
  await page.getByTestId('seed').fill('3')
  await page.getByTestId('restart').click()
  await page.keyboard.down('ArrowDown')
  await page.keyboard.down('s')
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'crashed', { timeout: 10000 })
  await page.keyboard.up('ArrowDown')
  await page.keyboard.up('s')
  const saved = {}
  for (const name of ['score', 'speed', 'altitude', 'throttle']) saved[name] = await page.getByTestId(name).textContent()
  const href = await page.getByTestId('share').getAttribute('href')
  const run = decodeRun(new URL(href, page.url()).searchParams.get('run'))
  expect(run.seed).toBe(3)
  expect(run.inputs.some(input => input.pitch === -1)).toBe(true)
  expect(run.inputs.every(input => [-1, 0, 1].includes(input.pitch))).toBe(true)
  expect(hud(replay(run.seed, run.inputs, 1 / 60))).toEqual(saved)
  await page.getByTestId('share').click()
  await expect(page.getByTestId('game')).toHaveAttribute('data-replay-complete', 'true', { timeout: 10000 })
  await expectHud(page, saved)
})
test('short playback freezes at its endpoint and malformed links recover without page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const inputs = Array.from({ length: 12 }, () => ({ pitch: 0, throttle: 1 }))
  await page.goto('/apps/flight/?run=' + encodeRun(7, inputs))
  await page.keyboard.down('ArrowDown')
  await expect(page.getByTestId('game')).toHaveAttribute('data-replay-complete', 'true')
  await expectHud(page, hud(replay(7, inputs, 1 / 60)))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expectHud(page, hud(replay(7, inputs, 1 / 60)))
  const href = await page.getByTestId('share').getAttribute('href')
  expect(decodeRun(new URL(href, page.url()).searchParams.get('run')).inputs).toEqual(inputs)
  await page.keyboard.up('ArrowDown')
  await page.goto('/apps/flight/?run=not-a-valid-run')
  await expect(page.locator('#replay-error')).toContainText('invalid')
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'flying')
  expect(errors).toEqual([])
})
