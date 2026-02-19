-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL DEFAULT 'D&D 5e',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "dungeonMasterName" TEXT,
    "description" TEXT,
    "currentStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "currentStatus", "description", "dungeonMasterName", "id", "name", "ownerId", "system", "updatedAt") SELECT "createdAt", "currentStatus", "description", "dungeonMasterName", "id", "name", "ownerId", "system", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
