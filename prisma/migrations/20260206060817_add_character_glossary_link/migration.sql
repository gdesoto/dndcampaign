-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "glossaryEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roleLabel" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCharacter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PlayerCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignCharacter_glossaryEntryId_fkey" FOREIGN KEY ("glossaryEntryId") REFERENCES "GlossaryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CampaignCharacter" ("campaignId", "characterId", "createdAt", "id", "notes", "roleLabel", "status", "updatedAt") SELECT "campaignId", "characterId", "createdAt", "id", "notes", "roleLabel", "status", "updatedAt" FROM "CampaignCharacter";
DROP TABLE "CampaignCharacter";
ALTER TABLE "new_CampaignCharacter" RENAME TO "CampaignCharacter";
CREATE INDEX "CampaignCharacter_campaignId_status_idx" ON "CampaignCharacter"("campaignId", "status");
CREATE INDEX "CampaignCharacter_characterId_idx" ON "CampaignCharacter"("characterId");
CREATE INDEX "CampaignCharacter_glossaryEntryId_idx" ON "CampaignCharacter"("glossaryEntryId");
CREATE UNIQUE INDEX "CampaignCharacter_campaignId_characterId_key" ON "CampaignCharacter"("campaignId", "characterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
