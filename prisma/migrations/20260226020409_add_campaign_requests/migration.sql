-- CreateTable
CREATE TABLE "CampaignRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignRequestVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignRequestId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignRequestVote_campaignRequestId_fkey" FOREIGN KEY ("campaignRequestId") REFERENCES "CampaignRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignRequestVote_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignRequestVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignRequest_campaignId_visibility_status_createdAt_idx" ON "CampaignRequest"("campaignId", "visibility", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRequest_campaignId_createdByUserId_createdAt_idx" ON "CampaignRequest"("campaignId", "createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRequest_campaignId_status_decidedAt_idx" ON "CampaignRequest"("campaignId", "status", "decidedAt");

-- CreateIndex
CREATE INDEX "CampaignRequestVote_campaignRequestId_createdAt_idx" ON "CampaignRequestVote"("campaignRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRequestVote_campaignId_userId_createdAt_idx" ON "CampaignRequestVote"("campaignId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRequestVote_campaignRequestId_userId_key" ON "CampaignRequestVote"("campaignRequestId", "userId");
