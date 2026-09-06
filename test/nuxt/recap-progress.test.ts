import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readRecapProgress, releaseRecapProgress, trackRecapProgress } from '../../app/utils/recap-progress'

describe('recap playback progress', () => {
  beforeEach(() => { localStorage.clear() })

  const media = (kind = 'audio') => {
    const el = document.createElement(kind) as HTMLMediaElement
    Object.defineProperty(el, 'duration', { configurable: true, value: 300 })
    return el
  }
  const fire = (el: HTMLMediaElement, name: string) => el.dispatchEvent(new Event(name))

  it.each(['audio', 'video'])('restores a %s recap after a return visit', (kind) => {
    const first = media(kind)
    trackRecapProgress(first, 'r1')
    fire(first, 'loadedmetadata')
    fire(first, 'play')
    first.currentTime = 123.5
    fire(first, 'timeupdate')
    releaseRecapProgress(first)

    const returning = media(kind)
    trackRecapProgress(returning, 'r1')
    // Loading events must not overwrite the saved position with zero.
    fire(returning, 'timeupdate')
    expect(readRecapProgress('r1')?.position).toBe(123.5)
    fire(returning, 'loadedmetadata')
    expect(returning.currentTime).toBe(123.5)
    releaseRecapProgress(returning)
  })

  it('flushes on leaving and keeps switched recaps separate', () => {
    const el = media()
    trackRecapProgress(el, 'r1')
    fire(el, 'loadedmetadata')
    fire(el, 'play')
    el.currentTime = 45
    window.dispatchEvent(new Event('pagehide'))
    expect(readRecapProgress('r1')?.position).toBe(45)
    trackRecapProgress(el, 'r2')
    el.currentTime = 0
    fire(el, 'loadedmetadata')
    fire(el, 'play')
    el.currentTime = 12
    fire(el, 'pause')
    expect(readRecapProgress('r1')?.position).toBe(45)
    expect(readRecapProgress('r2')?.position).toBe(12)
    releaseRecapProgress(el)
  })

  it('restarts completed or shortened media', () => {
    localStorage.setItem('dmvault-recap-progress-v1:r1', JSON.stringify({ position: 400, updatedAt: 1 }))
    const el = media()
    trackRecapProgress(el, 'r1')
    fire(el, 'loadedmetadata')
    expect(el.currentTime).toBe(0)
    fire(el, 'play')
    Object.defineProperty(el, 'ended', { value: true })
    el.currentTime = 300
    fire(el, 'ended')
    expect(readRecapProgress('r1')?.position).toBe(0)
    releaseRecapProgress(el)
  })

  it('ignores corrupt or unavailable storage', () => {
    localStorage.setItem('dmvault-recap-progress-v1:r1', '{broken')
    expect(readRecapProgress('r1')).toBeNull()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled') })
    const el = media()
    trackRecapProgress(el, 'r1')
    fire(el, 'loadedmetadata')
    expect(() => fire(el, 'play')).not.toThrow()
    releaseRecapProgress(el)
    spy.mockRestore()
  })
})
