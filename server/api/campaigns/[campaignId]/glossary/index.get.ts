import { getQuery } from 'h3'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { glossaryTypeSchema } from '#shared/schemas/glossary'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined
  const search = typeof query.search === 'string' ? query.search : undefined

  const typeParsed = type ? glossaryTypeSchema.safeParse(type) : null
  if (type && typeParsed && !typeParsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary type')
  }

  const entries = await prisma.glossaryEntry.findMany({
    where: {
      campaignId,
      ...(typeParsed?.success ? { type: typeParsed.data } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
              { aliases: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      sessions: {
        include: {
          session: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      campaignCharacters: {
        include: {
          character: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return ok(entries)
})

