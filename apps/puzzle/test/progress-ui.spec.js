import { test, expect } from '@playwright/test'

async function solve(page, detour = false) {
  if (detour) {
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
  }
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('status')).toContainText('Solved')
}

test('best scores persist, improve, and survive a worse replay and undo', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/apps/puzzle/')
  await expect(page.locator('#board .player')).toHaveCount(1)
  const first = page.locator('#level option[value="0"]')
  await expect(first).not.toContainText('✓')
  await solve(page, true)
  await expect(first).toContainText('✓ (5 moves)')
  await page.reload()
  await expect(first).toContainText('✓ (5 moves)')
  await expect(page.getByTestId('moves')).toHaveText('0')
  await solve(page)
  await expect(first).toContainText('✓ (3 moves)')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('status')).toHaveText('')
  await expect(first).toContainText('✓ (3 moves)')
  await page.getByTestId('restart').click()
  await solve(page, true)
  await expect(first).toContainText('✓ (3 moves)')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puzzle-progress'))))
    .toEqual({ 'First Push': { best: 3 } })
  await page.reload()
  await expect(first).toContainText('✓ (3 moves)')
  await expect(page.locator('#level option[value="1"]')).not.toContainText('✓')
  expect(errors).toEqual([])
})

test('selection and next-level navigation restore a fresh board after reload', async ({ page }) => {
  await page.goto('/apps/puzzle/')
  await page.getByTestId('level').selectOption('2')
  await page.reload()
  await expect(page.getByTestId('level')).toHaveValue('2')
  await expect(page.getByTestId('moves')).toHaveText('0')
  await page.getByTestId('level').selectOption('0')
  await solve(page)
  await page.keyboard.press('n')
  await expect(page.getByTestId('level')).toHaveValue('1')
  await page.reload()
  await expect(page.getByTestId('level')).toHaveValue('1')
  await expect(page.getByTestId('moves')).toHaveText('0')
  await expect(page.locator('#level option[value="0"]')).toContainText('✓ (3 moves)')
})

for (const saved of ['{broken', 'null', '{"First Push":{"best":-3},"Corner":{"best":12}}']) {
  test(`invalid saved progress does not prevent play: ${saved}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('puzzle-progress', value)
      localStorage.setItem('puzzle-last-level', 'missing level')
    }, saved)
    await page.goto('/apps/puzzle/')
    await expect(page.getByTestId('level')).toHaveValue('0')
    await expect(page.locator('#board .player')).toHaveCount(1)
    await expect(page.locator('#level option[value="0"]')).not.toContainText('✓')
    await solve(page)
    await expect(page.locator('#level option[value="0"]')).toContainText('✓ (3 moves)')
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzle-progress')))
    expect(progress['First Push']).toEqual({ best: 3 })
    if (saved.includes('Corner')) expect(progress.Corner).toEqual({ best: 12 })
  })
}

test('unavailable browser storage leaves solving and in-session scores usable', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable') }
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable') }
  })
  await page.goto('/apps/puzzle/')
  await expect(page.locator('#board .player')).toHaveCount(1)
  await solve(page)
  await expect(page.locator('#level option[value="0"]')).toContainText('✓ (3 moves)')
  await page.getByTestId('restart').click()
  await expect(page.getByTestId('moves')).toHaveText('0')
  await expect(page.locator('#level option[value="0"]')).toContainText('✓ (3 moves)')
  expect(errors).toEqual([])
})
