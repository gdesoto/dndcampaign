import { db } from '#server/db/client'
import * as tables from '#server/db/schema'



type ActivityScope = 'CAMPAIGN' | 'ADMIN' | 'SYSTEM'

type ActivityLogInput = {
  actorUserId?: string
  campaignId?: string
  scope: ActivityScope
  action: string
  targetType?: string
  targetId?: string
  summary?: string
  metadata?: typeof tables.activityLog.$inferInsert.metadata
}

export class ActivityLogService {
  async log(input: ActivityLogInput) {
    await db.insert(tables.activityLog).values({
      actorUserId: input.actorUserId,
      campaignId: input.campaignId,
      scope: input.scope,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      metadata: input.metadata
    }).returning().get()!
  }
}

