import { expect, test } from '@nuxt/test-utils/playwright'

test('encounter selection, editing, effects and phase controls work on desktop and mobile', async ({
  page,
  goto,
}, testInfo) => {
  test.setTimeout(180000)
  await goto('/login', { waitUntil: 'hydration' })
  await page
    .getByPlaceholder('you@example.com')
    .fill(process.env.SEED_USER_EMAIL || 'dm@example.com')
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.SEED_USER_PASSWORD || 'password123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/campaigns$/)
  const origin = new URL(page.url()).origin
  const campaigns = await page.request.get(`${origin}/api/campaigns`)
  const campaignId = (await campaigns.json()).data[0].id
  const created = await page.request.post(`${origin}/api/campaigns/${campaignId}/encounters`, {
    data: { name: 'Encounter workflow verification' },
  })
  expect(created.ok()).toBe(true)
  const encounterId = (await created.json()).data.id
  const base = `${origin}/api/encounters/${encounterId}`
  await page.request.post(`${base}/combatants`, {
    data: {
      participants: [
        { name: 'Aria', side: 'ALLY', maxHp: 24, tempHp: 5, speed: 30 },
        { name: 'Guard', side: 'NEUTRAL', maxHp: 16 },
      ],
    },
  })
  await goto(`/campaigns/${campaignId}/encounters/${encounterId}`, {
    waitUntil: 'hydration',
  })
  await expect(page.getByRole('button', { name: 'Start encounter', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next turn', exact: true })).toHaveCount(0)
  const heading = page.getByRole('heading', {
    name: /^Encounter workflow verification/,
  })
  await heading.evaluate(async element => {
    // Wait for the heading font to settle, including offline fallback.
    await Promise.allSettled([document.fonts.load(getComputedStyle(element).font, element.textContent || '')])
    await document.fonts.ready
  })
  const initialPosition = await heading.boundingBox()
  let releaseRefresh!: () => void
  let refreshStarted!: () => void
  const heldRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const refreshObserved = new Promise<void>((resolve) => {
    refreshStarted = resolve
  })
  await page.route(base, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    refreshStarted()
    await heldRefresh
    await route.continue()
  })
  await refreshObserved
  await expect(page.getByRole('status', { name: 'Refreshing encounter' })).toBeVisible()
  await expect(page.getByText('RefreshingÃ¢â‚¬Â¦ Showing previous results.')).toHaveCount(0)
  expect(await heading.boundingBox()).toEqual(initialPosition)
  const refreshed = page.waitForResponse(
    (response) => response.url() === base && response.request().method() === 'GET',
  )
  releaseRefresh()
  await refreshed
  await expect(page.getByRole('status', { name: 'Refreshing encounter' })).toHaveCount(0)
  await page.unroute(base)
  await expect(page.getByRole('button', { name: 'Add participant', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Roll initiative for Guard', exact: true }).click()
  await page.getByRole('button', { name: 'Clear initiative for Guard', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Roll initiative for Guard',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Roll initiative', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Roll all', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Clear initiative for Aria',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Roll initiative', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Clear initiative', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Roll initiative for Aria', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Start encounter', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next turn', exact: true })).toBeVisible()
  const before = (await (await page.request.get(base)).json()).data.activeParticipantId
  await page.getByRole('button', { name: 'Select Guard', exact: true }).click()
  expect((await (await page.request.get(base)).json()).data.activeParticipantId).toBe(before)
  const moveUp = page.getByRole('button', {
    name: 'Move Guard up',
    exact: true,
  })
  const moveDown = page.getByRole('button', {
    name: 'Move Guard down',
    exact: true,
  })
  await ((await moveUp.isEnabled()) ? moveUp : moveDown).click()
  await page.getByRole('button', { name: 'Add condition', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add condition' })).toBeVisible()
  await page.getByRole('button', { name: 'Condition*', exact: true }).click()
  await page.getByRole('option', { name: 'Prone', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add condition' })).toHaveCount(0)
  await expect(page.getByText('Prone', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Actions for Prone', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Edit condition' })).toBeVisible()
  await page.getByRole('button', { name: 'Condition*', exact: true }).click()
  await page.getByRole('option', { name: 'Custom condition…', exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.getByRole('textbox', { name: /^Custom condition/ }).fill('Marked by the hunter')
  await expect(page.getByRole('textbox', { name: /^Custom condition/ })).toHaveValue('Marked by the hunter')
  await page.screenshot({ path: testInfo.outputPath('condition-form.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Edit condition' })).toHaveCount(0)
  await expect(page.getByText('Marked by the hunter', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Damage', exact: true }).click()
  await expect(page.getByText('Enter a whole number from 1 to 9999.')).toBeVisible()
  await page.getByLabel('HP amount', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Damage', exact: true }).click()
  await expect(
    page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: 'Select Guard', exact: true }),
    }),
  ).toContainText('12/16')
  await page.getByRole('tab', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  const noteDialog = page.getByRole('dialog', { name: 'Add encounter note' })
  await expect(noteDialog).toBeVisible()
  await noteDialog.getByRole('textbox', { name: /^Note/ }).fill('Guard calls for reinforcements')
  await page.route(`${base}/events/note`, route => route.fulfill({
    status: 500, contentType: 'application/json',
    body: JSON.stringify({ data: null, error: { code: 'TEST_ERROR', message: 'Note could not be saved.' } }),
  }))
  await noteDialog.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(noteDialog.getByRole('alert')).toContainText('Note could not be saved.')
  await expect(noteDialog.getByRole('textbox', { name: /^Note/ })).toHaveValue('Guard calls for reinforcements')
  await page.unroute(`${base}/events/note`)
  await noteDialog.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(noteDialog).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Encounter event history' })).toContainText('Guard calls for reinforcements')
  await page.screenshot({ path: testInfo.outputPath('timeline.png'), fullPage: true })
  await page.getByRole('button', { name: 'Filter event types' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Note', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Encounter event history' }).locator('time')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('button', { name: 'Show oldest first' }).click()
  await expect(page.getByRole('button', { name: 'Show newest first' })).toBeVisible()
  await page.getByRole('tab', { name: 'Participants', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Guard', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Edit participant' })).toBeVisible()
  await page.getByLabel('Side', { exact: true }).click()
  await page.getByRole('option', { name: 'Ally', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Edit participant' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select Guard', exact: true })).toContainText(
    'Ally',
  )
  await page.screenshot({
    path: testInfo.outputPath('desktop-light.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Theme selector', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({
    path: testInfo.outputPath('desktop-dark.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Edit Guard', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    path: testInfo.outputPath('mobile-dark.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Theme selector', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath('mobile-light.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', {
      name: 'Actions for Encounter workflow verification',
      exact: true,
    })
    .click()
  await page.getByRole('menuitem', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next turn', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Set active turn', exact: true })).toHaveCount(0)
  await page
    .getByRole('button', {
      name: 'Actions for Encounter workflow verification',
      exact: true,
    })
    .click()
  await page.getByRole('menuitem', { name: 'Complete encounter', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add participant', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reopen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
})
