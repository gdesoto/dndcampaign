import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

const seedEmail = process.env.SEED_USER_EMAIL ?? 'dm@example.com'
const seedPassword = process.env.SEED_USER_PASSWORD ?? 'password123'

const gotoWithRetry = async (page: Pick<Page, 'goto' | 'waitForTimeout'>, url: string) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    const message = String((error as Error)?.message || '')
    if (!message.includes('ERR_ABORTED')) throw error
    await page.waitForTimeout(300)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  }
}

test('login and navigate campaign, session, and transcript editor', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })

  const emailInput = page.getByPlaceholder('you@example.com')
  const passwordInput = page.getByPlaceholder('••••••••')

  await emailInput.click()
  await emailInput.fill('')
  await emailInput.type(seedEmail)
  await expect(emailInput).toHaveValue(seedEmail)

  await passwordInput.click()
  await passwordInput.fill('')
  await passwordInput.type(seedPassword)
  await expect(passwordInput).toHaveValue(seedPassword)

  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/campaigns$/)
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()

  await page.getByRole('link', { name: 'Characters' }).click()
  await expect(page).toHaveURL(/\/characters$/)
  await expect(page.getByRole('heading', { name: 'Player Character Roster' })).toBeVisible()

  await page.getByRole('link', { name: 'Campaigns' }).click()
  await expect(page).toHaveURL(/\/campaigns$/)

  await page.locator('a').filter({ hasText: 'The Ashen Vale' }).first().click()
  await expect(page).toHaveURL(/\/campaigns\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'The Ashen Vale' })).toBeVisible()

  await page.getByRole('link', { name: 'Sessions' }).first().click()
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions$/)
  await expect(page.getByRole('heading', { name: 'Session log' })).toBeVisible()

  const sessionHref = await page.locator('a[href*="/sessions/"]').evaluateAll((links) => {
    const hrefs = links
      .map((link) => link.getAttribute('href') || '')
      .filter((href) => /\/campaigns\/[^/]+\/sessions\/[^/]+$/.test(href))
    return hrefs[0] || ''
  })
  expect(sessionHref).toBeTruthy()

  await gotoWithRetry(page, sessionHref)
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Session overview' })).toBeVisible()

  await gotoWithRetry(page, `${sessionHref}/transcription`)
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+\/transcription$/)
  await expect(page.getByRole('heading', { name: 'Transcript', exact: true })).toBeVisible()

  const openEditor = page.getByRole('link', { name: 'Open editor' })
  if (!(await openEditor.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Create transcript' }).click()
    await expect(openEditor).toBeVisible()
  }

  await openEditor.click()
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/documents\/[^/?#]+/)
  await expect(page.getByRole('heading', { name: 'Transcript editor' })).toBeVisible()
})
