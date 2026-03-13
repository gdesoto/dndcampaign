-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CAMPAIGN',
    "track" TEXT NOT NULL DEFAULT 'SIDE',
    "sourceType" TEXT NOT NULL DEFAULT 'FREE_TEXT',
    "sourceText" TEXT,
    "sourceNpcId" TEXT,
    "sourceCharacterId" TEXT,
    "reward" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progressNotes" TEXT,
    "expirationYear" INTEGER,
    "expirationMonth" INTEGER,
    "expirationDay" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quest_sourceNpcId_fkey" FOREIGN KEY ("sourceNpcId") REFERENCES "GlossaryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quest_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "PlayerCharacter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quest" ("campaignId", "createdAt", "description", "expirationDay", "expirationMonth", "expirationYear", "id", "progressNotes", "reward", "sortOrder", "sourceNpcId", "sourceText", "sourceType", "status", "title", "track", "type", "updatedAt") SELECT "campaignId", "createdAt", "description", "expirationDay", "expirationMonth", "expirationYear", "id", "progressNotes", "reward", "sortOrder", "sourceNpcId", "sourceText", "sourceType", "status", "title", "track", "type", "updatedAt" FROM "Quest";
DROP TABLE "Quest";
ALTER TABLE "new_Quest" RENAME TO "Quest";
CREATE INDEX "Quest_campaignId_idx" ON "Quest"("campaignId");
CREATE INDEX "Quest_sourceNpcId_idx" ON "Quest"("sourceNpcId");
CREATE INDEX "Quest_sourceCharacterId_idx" ON "Quest"("sourceCharacterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
