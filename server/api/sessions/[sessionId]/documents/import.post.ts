import { getRequestHeader } from 'h3'
import Busboy from 'busboy'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { DocumentService } from '#server/services/document.service'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['.txt', '.md', '.markdown', '.vtt']

const getExtension = (filename: string) => {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/)
  return match ? match[0] : ''
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!session) {
    return fail(404, 'NOT_FOUND', 'Session not found')
  }

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (!contentType.startsWith('multipart/form-data')) {
    return fail(400, 'VALIDATION_ERROR', 'Expected multipart form data')
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > MAX_BYTES) {
    return fail(400, 'VALIDATION_ERROR', 'File is too large')
  }

  let result
  try {
    result = await new Promise<{
      type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
      title?: string
      content: string
      format: 'MARKDOWN' | 'PLAINTEXT'
    }>((resolve, reject) => {
      const busboy = Busboy({
        headers: event.node.req.headers,
        limits: {
          fileSize: MAX_BYTES,
          files: 1,
          fields: 5,
        },
      })

      let typeValue = ''
      let titleValue = ''
      let fileHandled = false
      let fileError: string | null = null
      const chunks: Buffer[] = []
      let fileExt = ''

      busboy.on('field', (name, value) => {
        if (name === 'type') {
          typeValue = value.toUpperCase()
        }
        if (name === 'title') {
          titleValue = value
        }
      })

      busboy.on('file', (name, file, info) => {
        if (name !== 'file') {
          file.resume()
          return
        }
        fileHandled = true

        const filename = info.filename || ''
        fileExt = getExtension(filename)
        if (!filename || !ALLOWED_EXT.includes(fileExt)) {
          fileError = 'Unsupported file type'
          file.resume()
          return
        }

        file.on('data', (data: Buffer) => {
          chunks.push(data)
        })

        file.on('limit', () => {
          fileError = 'File is too large'
          file.destroy(new Error('File is too large'))
        })
      })

      busboy.on('filesLimit', () => {
        fileError = 'Only one file is allowed'
      })

      busboy.on('error', (error) => {
        reject(error)
      })

      busboy.on('finish', () => {
        if (fileError) {
          reject(new Error(fileError))
          return
        }
        if (!fileHandled) {
          reject(new Error('File is required'))
          return
        }
        const type =
          typeValue === 'SUMMARY'
            ? 'SUMMARY'
            : typeValue === 'NOTES'
              ? 'NOTES'
              : 'TRANSCRIPT'
        const format =
          fileExt === '.md' || fileExt === '.markdown' ? 'MARKDOWN' : 'PLAINTEXT'
        const content = Buffer.concat(chunks).toString('utf-8')
        resolve({
          type,
          title: titleValue || undefined,
          content,
          format,
        })
      })

      event.node.req.pipe(busboy)
    })
  } catch (error) {
    const message = (error as Error & { message?: string }).message || 'Upload failed'
    if (
      message === 'File is too large' ||
      message === 'Unsupported file type' ||
      message === 'File is required' ||
      message === 'Only one file is allowed'
    ) {
      return fail(400, 'VALIDATION_ERROR', message)
    }
    throw error
  }

  const service = new DocumentService()
  const existing = await prisma.document.findFirst({
    where: { sessionId, type: result.type },
  })

  const title =
    result.title ||
    `${result.type === 'SUMMARY' ? 'Summary' : 'Transcript'}: ${session.title}`

  const updated = existing
    ? await service.updateDocument({
        documentId: existing.id,
        content: result.content,
        format: result.format,
        source: 'USER_IMPORT',
        createdByUserId: sessionUser.user.id,
      })
    : await service.createDocument({
        campaignId: session.campaignId,
        sessionId,
        type: result.type,
        title,
        content: result.content,
        format: result.format,
        source: 'USER_IMPORT',
        createdByUserId: sessionUser.user.id,
      })

  return ok(updated)
})
