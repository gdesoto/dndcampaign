-- CreateTable
CREATE TABLE "CampaignJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'MYSELF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignJournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignJournalTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignJournalEntryId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "glossaryEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignJournalTag_campaignJournalEntryId_fkey" FOREIGN KEY ("campaignJournalEntryId") REFERENCES "CampaignJournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalTag_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalTag_glossaryEntryId_fkey" FOREIGN KEY ("glossaryEntryId") REFERENCES "GlossaryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignJournalEntrySessionLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignJournalEntryId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignJournalEntrySessionLink_campaignJournalEntryId_fkey" FOREIGN KEY ("campaignJournalEntryId") REFERENCES "CampaignJournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntrySessionLink_sessionId_campaignId_fkey" FOREIGN KEY ("sessionId", "campaignId") REFERENCES "Session" ("id", "campaignId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignJournalEntrySessionLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignPublicAccess" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT NOT NULL,
    "showCharacters" BOOLEAN NOT NULL DEFAULT false,
    "showRecaps" BOOLEAN NOT NULL DEFAULT false,
    "showSessions" BOOLEAN NOT NULL DEFAULT false,
    "showGlossary" BOOLEAN NOT NULL DEFAULT false,
    "showQuests" BOOLEAN NOT NULL DEFAULT false,
    "showMilestones" BOOLEAN NOT NULL DEFAULT false,
    "showMaps" BOOLEAN NOT NULL DEFAULT false,
    "showJournal" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignPublicAccess_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignPublicAccess_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CampaignPublicAccess" ("campaignId", "createdAt", "isEnabled", "isListed", "publicSlug", "showCharacters", "showGlossary", "showMaps", "showMilestones", "showQuests", "showRecaps", "showSessions", "updatedAt", "updatedByUserId") SELECT "campaignId", "createdAt", "isEnabled", "isListed", "publicSlug", "showCharacters", "showGlossary", "showMaps", "showMilestones", "showQuests", "showRecaps", "showSessions", "updatedAt", "updatedByUserId" FROM "CampaignPublicAccess";
DROP TABLE "CampaignPublicAccess";
ALTER TABLE "new_CampaignPublicAccess" RENAME TO "CampaignPublicAccess";
CREATE UNIQUE INDEX "CampaignPublicAccess_publicSlug_key" ON "CampaignPublicAccess"("publicSlug");
CREATE INDEX "CampaignPublicAccess_isEnabled_idx" ON "CampaignPublicAccess"("isEnabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CampaignJournalEntry_campaignId_visibility_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignJournalEntry_campaignId_authorUserId_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignJournalEntry_campaignId_createdAt_idx" ON "CampaignJournalEntry"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignJournalTag_campaignId_normalizedLabel_idx" ON "CampaignJournalTag"("campaignId", "normalizedLabel");

-- CreateIndex
CREATE INDEX "CampaignJournalTag_campaignJournalEntryId_tagType_idx" ON "CampaignJournalTag"("campaignJournalEntryId", "tagType");

-- CreateIndex
CREATE INDEX "CampaignJournalTag_campaignId_glossaryEntryId_idx" ON "CampaignJournalTag"("campaignId", "glossaryEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignJournalTag_campaignJournalEntryId_tagType_normalizedLabel_key" ON "CampaignJournalTag"("campaignJournalEntryId", "tagType", "normalizedLabel");

-- CreateIndex
CREATE INDEX "CampaignJournalEntrySessionLink_campaignId_sessionId_idx" ON "CampaignJournalEntrySessionLink"("campaignId", "sessionId");

-- CreateIndex
CREATE INDEX "CampaignJournalEntrySessionLink_campaignJournalEntryId_createdAt_idx" ON "CampaignJournalEntrySessionLink"("campaignJournalEntryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignJournalEntrySessionLink_campaignJournalEntryId_sessionId_key" ON "CampaignJournalEntrySessionLink"("campaignJournalEntryId", "sessionId");
