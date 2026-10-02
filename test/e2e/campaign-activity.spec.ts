import { expect, test } from '@nuxt/test-utils/playwright'

test('campaign activity shows readable events across themes and widths', async ({ page, goto }, testInfo) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.getByPlaceholder('you@example.com').fill(process.env.SEED_USER_EMAIL || 'dm@example.com')
  await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_USER_PASSWORD || 'password123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/campaigns$/)
  const origin = new URL(page.url()).origin
  const campaigns = await page.request.get(`${origin}/api/campaigns`)
  const campaignId = (await campaigns.json()).data[0].id
  const created = await page.request.post(`${origin}/api/campaigns/${campaignId}/encounters`, {
    data: { name: 'Moonlit ambush activity verification' },
  })
  expect(created.ok()).toBe(true)
  const encounterId = (await created.json()).data.id
  try {
    await goto(`/campaigns/${campaignId}`, { waitUntil: 'hydration' })
    const panel = page.locator('[data-slot="root"]').filter({ has: page.getByRole('heading', { name: 'Recent activity', exact: true }) }).last()
    await expect(panel.getByText(/Moonlit ambush activity verification/)).toBeVisible()
    await expect(panel).not.toContainText('/api/')
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(value) }, theme)
        await expect(panel).toBeVisible()
        await panel.screenshot({ path: testInfo.outputPath(`activity-${width}-${theme}.png`) })
      }
    }
  } finally {
    await page.request.delete(`${origin}/api/encounters/${encounterId}`)
  }
})
