import { prisma } from '#server/db/prisma'
import type { Prisma } from '@prisma/client'

type AdminAuditLogInput = {
  actorUserId: string
  action: string
  targetType: string
  targetId?: string
  summary?: string
  metadata?: Prisma.InputJsonValue
}

export class AdminAuditService {
  async log(input: AdminAuditLogInput) {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary,
        metadata: input.metadata,
      },
    })
  }
}
