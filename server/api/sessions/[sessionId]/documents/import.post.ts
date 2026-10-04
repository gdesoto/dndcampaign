import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readSingleFileUpload, streamToBuffer } from '#server/utils/multipart'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = new Set(['.txt', '.md', '.markdown', '.vtt'])

const getExtension = (filename: string) =>
  filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ''

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session =
    (await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'document.edit',
          tables.session.campaignId
        )
      )
    })) ?? null
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const { fields, result } = await readSingleFileUpload(event, {
    maxBytes: MAX_BYTES,
    maxFields: 5,
    accept: ({ filename }) => ALLOWED_EXT.has(getExtension(filename)),
    consume: async (file) => ({
      content: (await streamToBuffer(file.stream)).toString('utf-8'),
      format: ['.md', '.markdown'].includes(getExtension(file.filename))
        ? ('MARKDOWN' as const)
        : ('PLAINTEXT' as const)
    })
  })

  const typeField = (fields.type || '').toUpperCase()
  const type =
    typeField === 'SUMMARY' || typeField === 'NOTES' ? typeField : 'TRANSCRIPT'

  const service = new DocumentService()
  const title =
    fields.title ||
    `${type === 'SUMMARY' ? 'Summary' : 'Transcript'}: ${session.title}`

  const updated = await service.upsertForSession(sessionId, type, {
    campaignId: session.campaignId,
    title,
    content: result.content,
    format: result.format,
    source: 'USER_IMPORT',
    createdByUserId: sessionUser.user.id
  })

  return ok(updated)
})
