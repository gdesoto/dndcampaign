import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { ok } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignCreateSchema } from '#shared/schemas/campaign'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await validateBody(event, campaignCreateSchema, 'Invalid campaign payload')
  const campaign = db.transaction((tx) => {
    const created = tx.insert(tables.campaign).values({
      ownerId: session.user.id,
      name: parsed.name,
      system: parsed.system,
      description: parsed.description
    }).returning().get()!;
    tx.insert(tables.campaignMember).values({
      campaignId: created.id,
      userId: session.user.id,
      role: 'OWNER',
      invitedByUserId: session.user.id
    }).run();
    return created;
  }, { behavior: 'immediate' })
  return ok(campaign)
})
