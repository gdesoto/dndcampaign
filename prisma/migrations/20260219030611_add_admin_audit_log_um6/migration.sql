-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_createdAt_idx" ON "AdminAuditLog"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
