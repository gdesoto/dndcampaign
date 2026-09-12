import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { documentCreateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!session) {
    return fail(event, 404, 'NOT_FOUND', 'Session not found')
  }

  const parsed = await validateBody(event, documentCreateSchema, 'Invalid document payload')
  if (!parsed.ok) return parsed.response

  const existing = await prisma.document.findFirst({
    where: { sessionId, type: parsed.data.type },
  })
  if (existing) {
    return fail(event, 409, 'ALREADY_EXISTS', 'Document already exists for this session')
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
