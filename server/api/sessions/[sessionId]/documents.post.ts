import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { documentCreateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const parsed = await validateBody(event, documentCreateSchema, 'Invalid document payload')

  const existing = await prisma.document.findFirst({
    where: { sessionId, type: parsed.type },
  })
  if (existing) {
    throw apiError(409, 'ALREADY_EXISTS', 'Document already exists for this session')
  }

  const service = new DocumentService()
  const created = await service.createDocument({
    campaignId: session.campaignId,
    sessionId,
    type: parsed.type,
    title: parsed.title,
    content: parsed.content,
    format: parsed.format,
    source: 'USER_EDIT',
    createdByUserId: sessionUser.user.id,
  })

  return ok(created)
})
