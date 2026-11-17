import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { silentWav } from '../fixtures/media'

// A real production worker is needed to catch caching defaults and multi-tab activation.
test('installs with private data online only and leaves players and drafts alone during updates', async ({ page, context }, testInfo) => {
  await page.goto('/login')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  const manifestResponse = await page.request.get('/manifest.webmanifest')
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({ id: '/', name: 'DM Vault', display: 'standalone', start_url: '/', scope: '/' })
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
  for (const icon of manifest.icons) {
    const metadata = await sharp(await readFile(new URL(`../../public${icon.src}`, import.meta.url))).metadata()
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes)
    expect(metadata.hasAlpha).toBe(false)
  }
  const cdp = await context.newCDPSession(page)
  const installability = await cdp.send('Page.getInstallabilityErrors')
  expect(installability.installabilityErrors).toEqual([])

  const login = await page.request.post('/api/auth/login', {
    data: { email: process.env.SEED_USER_EMAIL || 'dm@example.com', password: process.env.SEED_USER_PASSWORD || 'password123' },
  })
  expect(login.ok()).toBe(true)
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible()
  const campaigns = await page.evaluate(async () => (await (await fetch('/api/campaigns')).json()).data)
  const campaignId = campaigns[0].id
  const sessionResponse = await page.request.post(`/api/campaigns/${campaignId}/sessions`, { data: { title: 'PWA validation' } })
  expect(sessionResponse.ok()).toBe(true)
  const sessionId = (await sessionResponse.json()).data.id

  // One minute of silent PCM exercises the actual native player and artifact range route.
  const wav = silentWav()
  const recordingResponse = await page.request.post(`/api/sessions/${sessionId}/recordings`, {
    multipart: { file: { name: 'pwa-validation.wav', mimeType: 'audio/wav', buffer: wav } },
  })
  expect(recordingResponse.ok()).toBe(true)
  const recording = (await recordingResponse.json()).data
  const streamPath = `/api/artifacts/${recording.artifactId}/stream`
  const ranged = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: 'bytes=0-8' } })
    return { status: response.status, range: response.headers.get('content-range'), body: Array.from(new Uint8Array(await response.arrayBuffer())) }
  }, streamPath)
  expect(ranged).toEqual({ status: 206, range: `bytes 0-8/${wav.length}`, body: Array.from(wav.subarray(0, 9)) })

  await page.goto(`/campaigns/${campaignId}/recordings/${recording.id}`)
  await page.getByRole('button', { name: 'Play in page player' }).click()
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio')
    return audio && !audio.paused && audio.currentTime > 0
  })
  const editor = await context.newPage()
  await editor.goto(`/campaigns/${campaignId}/sessions/${sessionId}`)
  await editor.getByRole('button', { name: 'Edit session', exact: true }).click()
  const draft = editor.getByRole('dialog').getByRole('textbox', { name: 'Title', exact: true })
  await draft.fill('Unsaved campaign notes')
  const editorTime = await editor.evaluate(() => performance.timeOrigin)
  const playerTime = await page.evaluate(() => performance.timeOrigin)
  const playbackPosition = await page.locator('audio').evaluate(audio => audio.currentTime)

  // Change only the generated worker, never source; restore even when an assertion fails.
  const workerPath = new URL('../../.output/public/sw.js', import.meta.url)
  const originalWorker = await readFile(workerPath, 'utf8')
  try {
    const nextWorker = context.waitForEvent('serviceworker')
    // Nitro embeds asset lengths at build time; change a revision without changing the length.
    const updatedWorker = originalWorker.replace(/(revision:[`"'])([0-9a-f])/, (_match, prefix, first) => `${prefix}${first === 'a' ? 'b' : 'a'}`)
    expect(updatedWorker).not.toBe(originalWorker)
    expect(updatedWorker.length).toBe(originalWorker.length)
    await writeFile(workerPath, updatedWorker)
    await cdp.send('Network.clearBrowserCache')
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
    const waitingWorker = await nextWorker
    await expect(page.getByRole('status', { name: 'Update notice' })).toBeVisible()
    await expect(editor.getByRole('status', { name: 'Update notice' })).toBeVisible()
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(playerTime)
    expect(await editor.evaluate(() => performance.timeOrigin)).toBe(editorTime)
    await expect(draft).toHaveValue('Unsaved campaign notes')
    expect(await page.locator('audio').evaluate(audio => !audio.paused && audio.currentTime > 0)).toBe(true)
    expect(await page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(playbackPosition)
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true)

    for (const [name, width, scheme] of [
      ['desktop-dark', 1280, 'dark'], ['desktop-light', 1280, 'light'],
      ['mobile-dark', 390, 'dark'], ['mobile-light', 390, 'light'],
    ] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: scheme })
      const notice = page.getByRole('status', { name: 'Update notice' })
      await expect(notice).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
    }
    await page.getByRole('status', { name: 'Update notice' }).getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('status', { name: 'Update notice' })).toHaveCount(0)
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true)

    await context.setOffline(true)
    await expect(page.getByRole('status', { name: 'Offline notice' })).toBeVisible()
    // Neither a cached API response nor offline HTML may stand in for API/media failures.
    for (const url of ['/api/campaigns', streamPath]) {
      expect(await page.evaluate(async path => {
        try { await fetch(path, { cache: 'no-store' }); return 'response' } catch { return 'network failure' }
      }, url)).toBe('network failure')
    }
    const offlinePage = await context.newPage()
    await offlinePage.setViewportSize({ width: 390, height: 900 })
    await offlinePage.emulateMedia({ colorScheme: 'light' })
    await offlinePage.goto(`/campaigns/${campaignId}`)
    await expect(offlinePage.getByRole('heading', { name: "You're offline" })).toBeVisible()
    await expect(offlinePage.getByText('The Ashen Vale')).toHaveCount(0)
    await offlinePage.screenshot({ path: testInfo.outputPath('offline-mobile-light.png') })
    await offlinePage.close()
    await context.setOffline(false)
    await expect(page.getByRole('status', { name: 'Offline notice' })).toHaveCount(0)

    const cacheUrls = await page.evaluate(async () => {
      const keys = await caches.keys()
      return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat()
    })
    expect(cacheUrls).toContain('/offline.html')
    for (const url of cacheUrls) {
      expect(url).toMatch(/^\/(?:offline\.html|favicon\.svg|manifest\.webmanifest|icons\/[^/]+\.png|_nuxt\/builds\/meta\/[^/]+\.json)$/)
    }
    await testInfo.attach('service-worker-cache-urls', { body: JSON.stringify(cacheUrls, null, 2), contentType: 'application/json' })

    // Closing one client cannot activate while another holds its draft.
    await page.close()
    expect(await editor.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true)
    // Explicitly discard the test draft before closing, just as a user must save/discard.
    await editor.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    const discard = editor.getByRole('button', { name: 'Discard changes', exact: true })
    if (await discard.isVisible()) await discard.click()
    await editor.close()
    // With no clients left, activation completes without any forced navigation.
    await expect.poll(() => waitingWorker.evaluate(async () => {
      // The worker realm still exposes the registration after all windows close.
      return (globalThis as unknown as { registration: ServiceWorkerRegistration }).registration.waiting === null
    })).toBe(true)
    const reopened = await context.newPage()
    await reopened.goto('/campaigns')
    await expect(reopened.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible()
    await expect(reopened.getByRole('status', { name: 'Update notice' })).toHaveCount(0)
  } finally {
    await writeFile(workerPath, originalWorker)
  }
})
