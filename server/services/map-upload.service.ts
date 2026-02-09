import { getRequestHeader } from 'h3'
import Busboy from 'busboy'
import type { H3Event } from 'h3'
import type { UploadedMapFile } from './map-parser.service'

type MapMultipartResult = {
  fields: Record<string, string>
  files: UploadedMapFile[]
}

const MAX_FILE_BYTES = 200 * 1024 * 1024

export const readMapMultipartUpload = async (event: H3Event): Promise<MapMultipartResult> => {
  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (!contentType.startsWith('multipart/form-data')) {
    throw new Error('Expected multipart form data')
  }

  return new Promise<MapMultipartResult>((resolve, reject) => {
    const busboy = Busboy({
      headers: event.node.req.headers,
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: 10,
        fields: 25,
      },
    })

    const fields: Record<string, string> = {}
    const files: UploadedMapFile[] = []
    let failed = false

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('file', (_name, file, info) => {
      const chunks: Buffer[] = []

      file.on('limit', () => {
        failed = true
        file.destroy(new Error('File is too large'))
      })

      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      file.on('end', () => {
        if (failed) return
        if (!info.filename) return
        files.push({
          filename: info.filename,
          mimeType: info.mimeType || 'application/octet-stream',
          buffer: Buffer.concat(chunks),
        })
      })
    })

    busboy.on('error', (error) => reject(error))
    busboy.on('filesLimit', () => reject(new Error('Too many files uploaded')))
    busboy.on('fieldsLimit', () => reject(new Error('Too many fields provided')))
    busboy.on('finish', () => {
      if (failed) {
        reject(new Error('File is too large'))
        return
      }
      resolve({ fields, files })
    })

    event.node.req.pipe(busboy)
  })
}
