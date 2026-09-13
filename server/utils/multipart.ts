import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import Busboy from 'busboy'
import type { Readable } from 'node:stream'
import { apiError } from '#server/utils/http'

export type UploadedFileInfo = {
  filename: string
  mimeType: string
  stream: Readable
}

export type MultipartUploadOptions<T> = {
  /** Per-file size limit in bytes. Also checked against Content-Length up front. */
  maxBytes: number
  maxFiles?: number
  maxFields?: number
  /** Return false to reject the file as an unsupported type. */
  accept?: (file: Pick<UploadedFileInfo, 'filename' | 'mimeType'>) => boolean
  /**
   * Consume one file. Must read `file.stream` to completion (pipe it to storage, buffer it, ...).
   * `fields` holds the form fields seen so far in the multipart body.
   */
  consume: (file: UploadedFileInfo, fields: Record<string, string>) => Promise<T>
}

const validationError = (message: string) => apiError(400, 'VALIDATION_ERROR', message)

/**
 * Parse a multipart/form-data request, handing each file to `consume`.
 * Throws a 400 for non-multipart bodies, oversized, unsupported, or too many files.
 */
export const readMultipartUpload = <T>(event: H3Event, options: MultipartUploadOptions<T>) => {
  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (!contentType.startsWith('multipart/form-data')) {
    throw validationError('Expected multipart form data')
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > options.maxBytes) {
    throw validationError('File is too large')
  }

  return new Promise<{ fields: Record<string, string>; results: T[] }>((resolve, reject) => {
    const busboy = Busboy({
      headers: event.node.req.headers,
      limits: {
        fileSize: options.maxBytes,
        files: options.maxFiles ?? 1,
        fields: options.maxFields ?? 10,
      },
    })

    const fields: Record<string, string> = {}
    const pending: Promise<T>[] = []
    let failure: Error | null = null

    const fail = (error: Error) => {
      failure ??= error
    }

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('file', (_name, stream, info) => {
      const filename = info.filename || ''
      const mimeType = info.mimeType || 'application/octet-stream'

      if (!filename) {
        stream.resume()
        return
      }

      if (options.accept && !options.accept({ filename, mimeType })) {
        fail(validationError('Unsupported file type'))
        stream.resume()
        return
      }

      stream.on('limit', () => {
        fail(validationError('File is too large'))
        stream.destroy(new Error('File is too large'))
      })

      pending.push(
        options.consume({ filename, mimeType, stream }, fields).catch((error) => {
          fail(error)
          return undefined as never
        })
      )
    })

    busboy.on('filesLimit', () => fail(validationError('Only one file is allowed')))
    busboy.on('fieldsLimit', () => fail(validationError('Too many fields provided')))
    busboy.on('error', (error) => reject(error))

    busboy.on('finish', async () => {
      const results = await Promise.all(pending)
      if (failure) {
        reject(failure)
        return
      }
      resolve({ fields, results })
    })

    event.node.req.pipe(busboy)
  })
}

/** Like `readMultipartUpload` for exactly one required file. */
export const readSingleFileUpload = async <T>(event: H3Event, options: Omit<MultipartUploadOptions<T>, 'maxFiles'>) => {
  const { fields, results } = await readMultipartUpload(event, { ...options, maxFiles: 1 })
  if (!results.length) {
    throw validationError('File is required')
  }
  return { fields, result: results[0] as T }
}

export const streamToBuffer = async (stream: Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
