import type { Readable } from 'node:stream'

export type PutObjectResult = {
  storageKey: string
  byteSize: number
  checksumSha256?: string
}

export type GetObjectResult = {
  stream: Readable
  size?: number
}

export type GetObjectInfoResult = {
  size: number
}

export type SignedUrlResult = {
  url: string
  expiresAt: string
}

export interface StorageAdapter {
  putObject(key: string, data: Buffer, mimeType: string): Promise<PutObjectResult>
  putObjectStream(
    key: string,
    stream: Readable,
    mimeType: string
  ): Promise<PutObjectResult>
  getObject(storageKey: string): Promise<GetObjectResult>
  getObjectInfo?(storageKey: string): Promise<GetObjectInfoResult>
  getObjectRange?(
    storageKey: string,
    range: { start: number; end: number }
  ): Promise<GetObjectResult>
  deleteObject(storageKey: string): Promise<void>
  exists(storageKey: string): Promise<boolean>
  getSignedUrl?(storageKey: string, expiresInSeconds: number): Promise<SignedUrlResult | null>
}
