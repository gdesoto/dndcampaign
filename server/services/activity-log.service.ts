import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'

type ActivityScope = 'CAMPAIGN' | 'ADMIN' | 'SYSTEM'

type ActivityLogInput = {
  actorUserId?: string
  campaignId?: string
  scope: ActivityScope
  action: string
  targetType?: string
  targetId?: string
  summary?: string
  metadata?: Prisma.InputJsonValue
}

export class ActivityLogService {
  async log(input: ActivityLogInput) {
    await prisma.activityLog.create({
      data: {
        actorUserId: input.actorUserId,
        campaignId: input.campaignId,
        scope: input.scope,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary,
        metadata: input.metadata,
      },
    })
  }
}

