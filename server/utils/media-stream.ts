import type { Readable } from 'node:stream'
import type { StorageAdapter } from '#server/services/storage/storage.types'

type MediaStream = { statusCode: number; headers: Record<string, string>; body: Readable | null }

export async function getMediaStream(adapter: StorageAdapter, storageKey: string, rangeHeader?: string): Promise<MediaStream> {
  const headers: Record<string, string> = {}
  if (adapter.getObjectRange && adapter.getObjectInfo) {
    headers['Accept-Ranges'] = 'bytes'
    const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/)
    if (match && (match[1] || match[2])) {
      const { size } = await adapter.getObjectInfo(storageKey)
      const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
      const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
        return { statusCode: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` }, body: null }
      }
      const { stream } = await adapter.getObjectRange(storageKey, { start, end })
      return {
        statusCode: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
        body: stream,
      }
    }
  }
  const { stream, size } = await adapter.getObject(storageKey)
  if (size != null) headers['Content-Length'] = String(size)
  return { statusCode: 200, headers, body: stream }
}

