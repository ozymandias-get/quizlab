import { expect, test } from '@playwright/test'

test.describe('Production preview smoke', () => {
  test('serves the app shell', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Quizlab Reader/)
    await expect(page.locator('#root')).toBeVisible()
  })
})
