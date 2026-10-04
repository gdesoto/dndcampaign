import { getQuery } from 'h3'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, or, eq, like, asc, desc } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { glossaryTypeSchema } from '#shared/schemas/glossary'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined
  const search = typeof query.search === 'string' ? query.search : undefined

  const typeParsed = type ? glossaryTypeSchema.safeParse(type) : null
  if (type && typeParsed && !typeParsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid glossary type')
  }

  const entries = await db.query.glossaryEntry.findMany({
    where: and(
      eq(tables.glossaryEntry.campaignId, campaignId),
      typeParsed?.success ? eq(tables.glossaryEntry.type, typeParsed.data) : undefined,
      search ? or(
        like(tables.glossaryEntry.name, `%${search}%`),
        like(tables.glossaryEntry.description, `%${search}%`),
        like(tables.glossaryEntry.aliases, `%${search}%`),
      ) : undefined,
    ),
    with: {
      sessions: {
        with: {
          session: {
            columns: { id: true, title: true, sessionNumber: true, playedAt: true },
          },
        },
        orderBy: [desc(tables.glossarySessionLink.createdAt)],
      },
      campaignCharacters: {
        with: {
          character: {
            columns: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [asc(tables.glossaryEntry.name)],
  })

  return ok(entries)
})

