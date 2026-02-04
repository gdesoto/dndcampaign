import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { StorageAdapter, PutObjectResult, GetObjectResult } from './storage.types'

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private root: string) {}

  private resolvePath(storageKey: string) {
    return join(this.root, storageKey)
  }

  async putObject(key: string, data: Buffer, _mimeType: string): Promise<PutObjectResult> {
    const filePath = this.resolvePath(key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, data)

    const checksum = createHash('sha256').update(data).digest('hex')
    return {
      storageKey: key,
      byteSize: data.length,
      checksumSha256: checksum,
    }
  }

  async putObjectStream(
    key: string,
    stream: Readable,
    _mimeType: string
  ): Promise<PutObjectResult> {
    const filePath = this.resolvePath(key)
    await mkdir(dirname(filePath), { recursive: true })

    const checksum = createHash('sha256')
    let byteSize = 0

    stream.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      byteSize += buffer.length
      checksum.update(buffer)
    })

    await pipeline(stream, createWriteStream(filePath))

    return {
      storageKey: key,
      byteSize,
      checksumSha256: checksum.digest('hex'),
    }
  }

  async getObject(storageKey: string): Promise<GetObjectResult> {
    const filePath = this.resolvePath(storageKey)
    const stats = await stat(filePath)
    return {
      stream: createReadStream(filePath),
      size: stats.size,
    }
  }

  async getObjectInfo(storageKey: string) {
    const filePath = this.resolvePath(storageKey)
    const stats = await stat(filePath)
    return { size: stats.size }
  }

  async getObjectRange(
    storageKey: string,
    range: { start: number; end: number }
  ): Promise<GetObjectResult> {
    const filePath = this.resolvePath(storageKey)
    const stats = await stat(filePath)
    return {
      stream: createReadStream(filePath, { start: range.start, end: range.end }),
      size: stats.size,
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    const filePath = this.resolvePath(storageKey)
    await unlink(filePath)
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolvePath(storageKey)
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }
}
