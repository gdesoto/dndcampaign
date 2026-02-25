-- CreateTable
CREATE TABLE "CampaignDungeon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "theme" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "gridType" TEXT NOT NULL DEFAULT 'SQUARE',
    "generatorVersion" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "mapJson" JSONB NOT NULL,
    "playerViewJson" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignDungeon_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDungeon_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDungeonRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dungeonId" TEXT NOT NULL,
    "roomNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gmNotes" TEXT,
    "playerNotes" TEXT,
    "readAloud" TEXT,
    "tagsJson" JSONB,
    "boundsJson" JSONB,
    "state" TEXT NOT NULL DEFAULT 'UNSEEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignDungeonRoom_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "CampaignDungeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDungeonLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dungeonId" TEXT NOT NULL,
    "roomId" TEXT,
    "linkType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDungeonLink_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "CampaignDungeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDungeonLink_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "CampaignDungeonRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDungeonSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dungeonId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "generatorVersion" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "mapJson" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDungeonSnapshot_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "CampaignDungeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDungeonSnapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignDungeon_campaignId_updatedAt_idx" ON "CampaignDungeon"("campaignId", "updatedAt");

-- CreateIndex
CREATE INDEX "CampaignDungeon_campaignId_status_updatedAt_idx" ON "CampaignDungeon"("campaignId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CampaignDungeon_createdByUserId_idx" ON "CampaignDungeon"("createdByUserId");

-- CreateIndex
CREATE INDEX "CampaignDungeonRoom_dungeonId_roomNumber_idx" ON "CampaignDungeonRoom"("dungeonId", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDungeonRoom_dungeonId_roomNumber_key" ON "CampaignDungeonRoom"("dungeonId", "roomNumber");

-- CreateIndex
CREATE INDEX "CampaignDungeonLink_dungeonId_createdAt_idx" ON "CampaignDungeonLink"("dungeonId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignDungeonLink_roomId_idx" ON "CampaignDungeonLink"("roomId");

-- CreateIndex
CREATE INDEX "CampaignDungeonLink_linkType_targetId_idx" ON "CampaignDungeonLink"("linkType", "targetId");

-- CreateIndex
CREATE INDEX "CampaignDungeonSnapshot_dungeonId_createdAt_idx" ON "CampaignDungeonSnapshot"("dungeonId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignDungeonSnapshot_createdByUserId_idx" ON "CampaignDungeonSnapshot"("createdByUserId");
