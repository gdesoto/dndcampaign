import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { StorageAdapter } from '../../server/services/storage/storage.types'
import { getMediaStream } from '../../server/utils/media-stream'

describe('media byte ranges', () => {
  const adapter = () => ({
    getObjectInfo: vi.fn(async () => ({ size: 17 })),
    getObjectRange: vi.fn(async () => ({ stream: Readable.from('media') })),
    getObject: vi.fn(async () => ({ stream: Readable.from('recap media bytes'), size: 17 })),
  })
  it.each([
    ['bytes=6-10', 6, 10], ['bytes=6-', 6, 16], ['bytes=-5', 12, 16], ['bytes=6-999', 6, 16],
  ])('serves %s with accurate headers', async (range, start, end) => {
    const storage = adapter()
    const response = await getMediaStream(storage as unknown as StorageAdapter, 'key', range)
    expect(response.statusCode).toBe(206)
    expect(response.headers['Content-Range']).toBe(`bytes ${start}-${end}/17`)
    expect(response.headers['Content-Length']).toBe(String(end - start + 1))
    expect(storage.getObjectRange).toHaveBeenCalledWith('key', { start, end })
    expect(storage.getObject).not.toHaveBeenCalled()
    response.body?.destroy()
  })
  it.each(['bytes=17-', 'bytes=10-6', 'bytes=-0'])('rejects unsatisfiable %s without opening a stream', async range => {
    const storage = adapter()
    const response = await getMediaStream(storage as unknown as StorageAdapter, 'key', range)
    expect(response.statusCode).toBe(416)
    expect(response.headers['Content-Range']).toBe('bytes */17')
    expect(storage.getObjectRange).not.toHaveBeenCalled()
    expect(response.body).toBeNull()
  })
  it('serves a full stream when no range is requested', async () => {
    const storage = adapter()
    const response = await getMediaStream(storage as unknown as StorageAdapter, 'key')
    expect(response.statusCode).toBe(200)
    expect(response.headers).toEqual({ 'Accept-Ranges': 'bytes', 'Content-Length': '17' })
    response.body?.destroy()
  })
})
