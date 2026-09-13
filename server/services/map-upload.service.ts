import type { H3Event } from 'h3'
import { readMultipartUpload, streamToBuffer } from '#server/utils/multipart'
import type { UploadedMapFile } from './map-parser.service'

const MAX_FILE_BYTES = 200 * 1024 * 1024

export const readMapMultipartUpload = async (event: H3Event) => {
  const { fields, results } = await readMultipartUpload<UploadedMapFile>(event, {
    maxBytes: MAX_FILE_BYTES,
    maxFiles: 10,
    maxFields: 25,
    consume: async (file) => ({
      filename: file.filename,
      mimeType: file.mimeType,
      buffer: await streamToBuffer(file.stream),
    }),
  })
  return { fields, files: results }
}
