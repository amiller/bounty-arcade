import { test, expect } from '@playwright/test'

const keys = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' }
async function play(page, sequence) {
  for (const dir of sequence.toLowerCase()) await page.keyboard.press(keys[dir])
}

for (const [level, sequence, index] of [['1', 'DLdR', 28], ['4', 'URurDD', 33]]) {
  test(`level ${level} marks the exact corner and clears on undo and restart`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/apps/puzzle/')
    await page.getByTestId('level').selectOption(level)
    await expect(page.locator('#board .dead')).toHaveCount(0)
    await play(page, sequence)
    await expect(page.locator('#board .dead')).toHaveCount(1)
    const dead = page.locator('#board .cell').nth(index)
    await expect(dead).toHaveClass(/\bbox\b/)
    await expect(dead).toHaveClass(/\bdead\b/)
    await expect(page.getByTestId('status')).toHaveText('Stuck: a box is in a corner')
    expect(await dead.evaluate(cell => getComputedStyle(cell, '::before').borderStyle)).toBe('dashed')
    await page.getByTestId('undo').click()
    await expect(page.locator('#board .dead')).toHaveCount(0)
    await expect(page.getByTestId('status')).toHaveText('')
    await play(page, sequence.at(-1))
    await expect(page.locator('#board .dead')).toHaveCount(1)
    await page.keyboard.press('z')
    await expect(page.locator('#board .dead')).toHaveCount(0)
    await expect(page.getByTestId('status')).toHaveText('')
    await play(page, sequence.at(-1))
    await page.getByTestId('restart').click()
    await expect(page.locator('#board .dead')).toHaveCount(0)
    await expect(page.getByTestId('status')).toHaveText('')
    await expect(page.getByTestId('moves')).toHaveText('0')
    expect(errors).toEqual([])
  })
}

test('wall-only and goal boxes stay unmarked, and changing level clears warnings', async ({ page }) => {
  await page.goto('/apps/puzzle/')
  await expect(page.locator('#board .player')).toHaveCount(1)
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('move-r').click()
    await expect(page.locator('#board .dead')).toHaveCount(0)
  }
  await expect(page.getByTestId('status')).toContainText('Solved')
  await expect(page.locator('#board .box.goal')).toHaveCount(1)
  await page.getByTestId('level').selectOption('1')
  await play(page, 'DLdR')
  await expect(page.locator('#board .dead')).toHaveCount(1)
  await page.getByTestId('level').selectOption('0')
  await expect(page.locator('#board .dead')).toHaveCount(0)
  await expect(page.getByTestId('status')).toHaveText('')
})
