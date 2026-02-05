-- CreateTable
CREATE TABLE "PlayerCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "portraitUrl" TEXT,
    "portraitArtifactId" TEXT,
    "sheetJson" JSONB NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "sourceProvider" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCharacter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerCharacter_portraitArtifactId_fkey" FOREIGN KEY ("portraitArtifactId") REFERENCES "Artifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roleLabel" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCharacter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PlayerCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "rawJson" JSONB NOT NULL,
    "rawHash" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    CONSTRAINT "CharacterImport_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PlayerCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterImportSettings" (
    "characterId" TEXT NOT NULL PRIMARY KEY,
    "lockedSections" JSONB,
    "defaultOverwriteMode" TEXT NOT NULL DEFAULT 'SECTIONS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterImportSettings_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PlayerCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlayerCharacter_ownerId_idx" ON "PlayerCharacter"("ownerId");

-- CreateIndex
CREATE INDEX "PlayerCharacter_name_idx" ON "PlayerCharacter"("name");

-- CreateIndex
CREATE INDEX "CampaignCharacter_campaignId_status_idx" ON "CampaignCharacter"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignCharacter_characterId_idx" ON "CampaignCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCharacter_campaignId_characterId_key" ON "CampaignCharacter"("campaignId", "characterId");

-- CreateIndex
CREATE INDEX "CharacterImport_characterId_idx" ON "CharacterImport"("characterId");

-- CreateIndex
CREATE INDEX "CharacterImport_provider_externalId_idx" ON "CharacterImport"("provider", "externalId");
