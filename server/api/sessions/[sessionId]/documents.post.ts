import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { documentCreateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'

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

  const parsed = await readValidatedBodySafe(event, documentCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid document payload', parsed.fieldErrors)
  }

  const existing = await prisma.document.findFirst({
    where: { sessionId, type: parsed.data.type },
  })
  if (existing) {
    return fail(409, 'ALREADY_EXISTS', 'Document already exists for this session')
  }

  const service = new DocumentService()
  const created = await service.createDocument({
    campaignId: session.campaignId,
    sessionId,
    type: parsed.data.type,
    title: parsed.data.title,
    content: parsed.data.content,
    format: parsed.data.format,
    source: 'USER_EDIT',
    createdByUserId: sessionUser.user.id,
  })

  return ok(created)
})
