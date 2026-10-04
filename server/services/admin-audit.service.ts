import { db } from '#server/db/client'
import * as tables from '#server/db/schema'



type AdminAuditLogInput = {
  actorUserId: string
  action: string
  targetType: string
  targetId?: string
  summary?: string
  metadata?: typeof tables.adminAuditLog.$inferInsert.metadata
}

export class AdminAuditService {
  async log(input: AdminAuditLogInput) {
    await db.insert(tables.adminAuditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      metadata: input.metadata
    }).returning().get()!
  }
}

