import { expect, test } from '@nuxt/test-utils/playwright'

test('admin dashboard preserves sections, direct routes, themes, and mobile navigation', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(process.env.SEED_ADMIN_PASSWORD ?? 'password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/campaigns$/)
  await goto('/admin/users', { waitUntil: 'hydration' })
  const navigation = page.getByRole('navigation', { name: 'Admin sections' })
  await expect(page.getByRole('heading', { level: 1, name: 'User management' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save user', exact: true })).toBeVisible()
  await page.reload()
  await page.waitForFunction(() => (window as Window & { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false)
  await expect(navigation.getByRole('link', { name: 'Users', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expect(navigation).toBeHidden()
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  await expect(navigation).toBeVisible()

  for (const [link, heading] of [
    ['Overview', 'System administration'], ['Campaigns', 'Campaign management'],
    ['Analytics', 'Analytics and reporting'], ['Activity log', 'Activity log'],
    ['Storage audit', 'Storage audit'], ['Dev Tools', 'Dev Tools'],
  ]) {
    await navigation.getByRole('link', { name: link!, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading!, exact: true })).toBeVisible()
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(navigation.getByRole('link', { name: link!, exact: true })).toHaveAttribute('aria-current', 'page')
  }
  await expect(page.getByRole('button', { name: 'Send test webhook', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run migration', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Storage audit' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Document integrity', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Dev Tools' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click()
  const menu = page.getByRole('dialog', { name: 'Admin navigation' })
  await expect(menu).toBeVisible()
  await menu.getByRole('link', { name: 'Analytics', exact: true }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Analytics and reporting' })).toBeVisible()
  await page.getByRole('tab', { name: 'Usage', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Export CSV', exact: true })).toHaveAttribute('href', /usage.*csv|usage\/export/)
  await page.getByRole('tab', { name: 'Jobs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Job success rates', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const mode of ['Dark', 'Light', 'System']) {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: mode, exact: true }).click()
    await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Logout', exact: true })).toBeVisible()
})
