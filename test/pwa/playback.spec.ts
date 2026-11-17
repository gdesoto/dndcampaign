import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { silentWav } from '../fixtures/media'

test('plays private/public media with one persistent player, captions, resume, queue and system controls', async ({ page, context, browser }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  // Exercise the app's registered handlers, not OS/headset delivery of those actions.
  await context.addInitScript(() => {
    const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>()
    const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler = (action, handler) => {
      handlers.set(action, handler)
      original(action, handler)
    }
    Object.assign(window, { systemMediaAction: (action: MediaSessionAction, detail = {}) => handlers.get(action)?.({ action, ...detail }) })
  })
  const login = await page.request.post('/api/auth/login', {
    data: { email: process.env.SEED_USER_EMAIL || 'dm@example.com', password: process.env.SEED_USER_PASSWORD || 'password123' },
  })
  expect(login.ok()).toBe(true)
  const campaigns = (await (await page.request.get('/api/campaigns')).json()).data
  const campaignId = campaigns[0].id
  const video = await readFile(new URL('../fixtures/playback.webm', import.meta.url))
  const recaps: { id: string; artifactId: string }[] = []
  const sessions: string[] = []
  for (const number of [21, 22, 23]) {
    const response = await page.request.post(`/api/campaigns/${campaignId}/sessions`, { data: { title: `Playback session ${number}`, sessionNumber: number } })
    expect(response.ok()).toBe(true)
    const sessionId = (await response.json()).data.id
    sessions.push(sessionId)
    const upload = await page.request.post(`/api/sessions/${sessionId}/recap`, {
      multipart: { file: number === 22
        ? { name: 'video.webm', mimeType: 'video/webm', buffer: video }
        : { name: 'audio.wav', mimeType: 'audio/wav', buffer: silentWav() } },
    })
    expect(upload.ok()).toBe(true)
    recaps.push((await upload.json()).data)
  }

  const watchPath = `/campaigns/${campaignId}/watch?recap=${recaps[0]!.id}`
  await page.goto(watchPath)
  await expect(page.locator('audio-neutral-skin')).toBeVisible()
  expect(await page.locator('audio').evaluate(media => media.paused)).toBe(true)
  await page.locator('audio-neutral-skin').getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > 0)
  await page.evaluate(() => Object.assign(window, { originalMedia: document.querySelector('audio'), mediaPauses: 0 }))
  await page.locator('audio').evaluate(media => media.addEventListener('pause', () => {
    const state = window as unknown as { mediaPauses: number }; state.mediaPauses++
  }))
  await page.getByRole('link', { name: 'Campaign overview', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`))
  expect(await page.evaluate(() => document.querySelector('audio') === (window as unknown as { originalMedia: HTMLMediaElement }).originalMedia)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { mediaPauses: number }).mediaPauses)).toBe(0)
  await page.getByRole('button', { name: 'Open full player', exact: true }).click()
  await expect(page.locator('#media-player-drawer-target audio-neutral-skin')).toBeVisible()
  const handle = page.locator('[data-vaul-handle]')
  await expect(handle).toBeVisible()
  await handle.hover()
  const grab = (await handle.boundingBox())!
  await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2)
  await page.mouse.down()
  await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2 + 120, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('#media-player-drawer-target')).not.toBeVisible()
  expect(await page.locator('audio').evaluate(media => !media.paused)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { mediaPauses: number }).mediaPauses)).toBe(0)
  expect(await page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('Playback session 21')
  await page.evaluate(() => (window as unknown as { systemMediaAction: (action: string, detail: { seekTime: number }) => void }).systemMediaAction('seekto', { seekTime: 59.8 }))
  await expect(page.locator('video')).toHaveCount(1)
  await expect(page.locator('audio')).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  await page.getByRole('button', { name: 'Open full player', exact: true }).click()
  await expect(page.locator('video-neutral-skin')).toBeVisible()
  await page.getByRole('button', { name: /fullscreen/i }).click()
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
  await page.evaluate(() => document.exitFullscreen())
  for (const [name, width, scheme] of [
    ['desktop-dark', 1280, 'dark'], ['desktop-light', 1280, 'light'],
    ['mobile-dark', 390, 'dark'], ['mobile-light', 390, 'light'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: scheme })
    await expect(page.locator('video-neutral-skin')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
  }
  await page.getByRole('button', { name: 'Minimize media player' }).click()
  await page.evaluate(() => (window as unknown as { systemMediaAction: (action: string) => void }).systemMediaAction('nexttrack'))
  await expect(page.locator('audio')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('Playback session 23')
  await page.locator('audio').evaluate(media => { media.currentTime = 25 })
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem(`dmvault-recap-progress-v1:${id}`) || 'null')?.position, recaps[2]!.id)).toBeGreaterThanOrEqual(25)
  await page.reload()
  await page.goto(`/campaigns/${campaignId}/watch?recap=${recaps[2]!.id}`)
  await expect.poll(() => page.locator('audio').evaluate(media => media.currentTime)).toBeGreaterThanOrEqual(25)
  expect(await page.locator('audio').evaluate(media => media.paused)).toBe(true)

  // Recording captions, a real failed stream, and user-initiated recovery.
  const recordingUpload = await page.request.post(`/api/sessions/${sessions[1]}/recordings`, {
    multipart: { kind: 'VIDEO', file: { name: 'captioned.webm', mimeType: 'video/webm', buffer: video } },
  })
  expect(recordingUpload.ok()).toBe(true)
  const recording = (await recordingUpload.json()).data
  const captions = await page.request.post(`/api/recordings/${recording.id}/captions`, {
    multipart: { file: { name: 'captions.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:12.000\nInto the vault.\n') } },
  })
  expect(captions.ok()).toBe(true)
  await page.getByRole('link', { name: 'Campaign overview', exact: true }).click()
  await page.getByRole('button', { name: 'Close media player' }).click()
  await page.goto(`/campaigns/${campaignId}/recordings/${recording.id}`)
  const streamPattern = `**/api/artifacts/${recording.artifactId}/stream`
  await page.route(streamPattern, route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.getByRole('button', { name: 'Play in page player' }).click()
  await expect(page.getByRole('button', { name: 'Retry playback', exact: true })).toBeVisible()
  await page.unroute(streamPattern)
  await page.getByRole('button', { name: 'Retry playback', exact: true }).click()
  await page.waitForFunction(() => !!document.querySelector('video') && !document.querySelector('video')!.paused)
  await expect.poll(() => page.locator('video').evaluate(media => media.textTracks[0]?.cues?.length)).toBe(1)
  await page.locator('video-neutral-skin').getByRole('button', { name: 'Pause', exact: true }).last().click()
  await page.locator('video').evaluate(media => { media.currentTime = 1 })
  await expect.poll(() => page.locator('video').evaluate(media => (media.textTracks[0]?.activeCues?.[0] as VTTCue)?.text)).toBe('Into the vault.')
  // At compact widths the packaged skin puts caption selection in Settings.
  await page.locator('video-neutral-skin').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitem', { name: /Captions/ }).click()
  await page.getByRole('menuitemradio', { name: 'Off', exact: true }).click()
  await expect.poll(() => page.locator('video').evaluate(media => media.textTracks[0]?.mode)).toBe('disabled')

  const settings = await page.request.patch(`/api/campaigns/${campaignId}/public/access`, { data: { isEnabled: true, showRecaps: true } })
  expect(settings.ok()).toBe(true)
  const publicSlug = (await settings.json()).data.publicSlug
  const anonymous = await browser.newContext()
  try {
    const publicPage = await anonymous.newPage()
    publicPage.on('pageerror', error => runtimeErrors.push(error.message))
    const base = new URL(page.url()).origin
    await publicPage.goto(`${base}/public/${publicSlug}/watch?recap=${recaps[1]!.id}`)
    await expect(publicPage.locator('video-neutral-skin')).toBeVisible()
    await publicPage.locator('video-neutral-skin').getByRole('button', { name: 'Play', exact: true }).first().click()
    await publicPage.waitForFunction(() => !document.querySelector('video')!.paused)
    const ranged = await publicPage.request.get(`${base}/api/public/campaigns/${publicSlug}/recaps/${recaps[1]!.id}/stream`, { headers: { Range: 'bytes=0-8' } })
    expect(ranged.status()).toBe(206)
    const denied = await publicPage.request.get(`${base}/api/artifacts/${recaps[1]!.artifactId}/stream`)
    expect(denied.status()).toBe(403)
    expect(await denied.json()).toMatchObject({ data: null, error: { code: 'FORBIDDEN' } })
  } finally {
    await anonymous.close()
  }
  expect(runtimeErrors).toEqual([])
})
