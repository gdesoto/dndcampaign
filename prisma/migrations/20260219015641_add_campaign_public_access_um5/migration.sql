-- CreateTable
CREATE TABLE "CampaignPublicAccess" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT NOT NULL,
    "showCharacters" BOOLEAN NOT NULL DEFAULT false,
    "showRecaps" BOOLEAN NOT NULL DEFAULT false,
    "showSessions" BOOLEAN NOT NULL DEFAULT false,
    "showGlossary" BOOLEAN NOT NULL DEFAULT false,
    "showQuests" BOOLEAN NOT NULL DEFAULT false,
    "showMilestones" BOOLEAN NOT NULL DEFAULT false,
    "showMaps" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignPublicAccess_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignPublicAccess_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPublicAccess_publicSlug_key" ON "CampaignPublicAccess"("publicSlug");

-- CreateIndex
CREATE INDEX "CampaignPublicAccess_isEnabled_idx" ON "CampaignPublicAccess"("isEnabled");
