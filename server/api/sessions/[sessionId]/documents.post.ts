import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { documentCreateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session =
    (await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.write',
          tables.session.campaignId
        )
      )
    })) ?? null
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const parsed = await validateBody(
    event,
    documentCreateSchema,
    'Invalid document payload'
  )

  const existing =
    (await db.query.document.findFirst({
      where: and(
        eq(tables.document.sessionId, sessionId),
        eq(tables.document.type, parsed.type)
      )
    })) ?? null
  if (existing) {
    throw apiError(
      409,
      'ALREADY_EXISTS',
      'Document already exists for this session'
    )
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
    createdByUserId: sessionUser.user.id
  })

  return ok(created)
})
