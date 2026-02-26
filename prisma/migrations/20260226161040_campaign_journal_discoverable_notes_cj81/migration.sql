-- CreateTable
CREATE TABLE "CampaignJournalEntryTransferHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignJournalEntryId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fromHolderUserId" TEXT,
    "toHolderUserId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignJournalEntryTransferHistory_campaignJournalEntryId_fkey" FOREIGN KEY ("campaignJournalEntryId") REFERENCES "CampaignJournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntryTransferHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntryTransferHistory_fromHolderUserId_fkey" FOREIGN KEY ("fromHolderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntryTransferHistory_toHolderUserId_fkey" FOREIGN KEY ("toHolderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntryTransferHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "holderUserId" TEXT,
    "discoveredByUserId" TEXT,
    "archivedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'MYSELF',
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT false,
    "discoveredAt" DATETIME,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignJournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_discoveredByUserId_fkey" FOREIGN KEY ("discoveredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CampaignJournalEntry" ("authorUserId", "campaignId", "contentMarkdown", "createdAt", "id", "title", "updatedAt", "visibility") SELECT "authorUserId", "campaignId", "contentMarkdown", "createdAt", "id", "title", "updatedAt", "visibility" FROM "CampaignJournalEntry";
DROP TABLE "CampaignJournalEntry";
ALTER TABLE "new_CampaignJournalEntry" RENAME TO "CampaignJournalEntry";
CREATE INDEX "CampaignJournalEntry_campaignId_visibility_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "visibility", "createdAt");
CREATE INDEX "CampaignJournalEntry_campaignId_authorUserId_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "authorUserId", "createdAt");
CREATE INDEX "CampaignJournalEntry_campaignId_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "createdAt");
CREATE INDEX "CampaignJournalEntry_campaignId_isDiscoverable_updatedAt_idx" ON "CampaignJournalEntry"("campaignId", "isDiscoverable", "updatedAt");
CREATE INDEX "CampaignJournalEntry_campaignId_holderUserId_updatedAt_idx" ON "CampaignJournalEntry"("campaignId", "holderUserId", "updatedAt");
CREATE INDEX "CampaignJournalEntry_campaignId_isArchived_updatedAt_idx" ON "CampaignJournalEntry"("campaignId", "isArchived", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CampaignJournalEntryTransferHistory_campaignJournalEntryId_createdAt_idx" ON "CampaignJournalEntryTransferHistory"("campaignJournalEntryId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignJournalEntryTransferHistory_campaignId_createdAt_idx" ON "CampaignJournalEntryTransferHistory"("campaignId", "createdAt");
