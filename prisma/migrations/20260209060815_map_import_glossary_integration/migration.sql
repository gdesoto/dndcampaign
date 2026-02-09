-- CreateTable
CREATE TABLE "CampaignMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceType" TEXT NOT NULL DEFAULT 'AZGAAR_FULL_JSON',
    "createdById" TEXT NOT NULL,
    "rawManifestJson" JSONB,
    "importVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceFingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignMapFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignMapId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMapFile_campaignMapId_fkey" FOREIGN KEY ("campaignMapId") REFERENCES "CampaignMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignMapFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignMapId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "featureType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "geometryType" TEXT NOT NULL,
    "geometryJson" JSONB NOT NULL,
    "propertiesJson" JSONB,
    "sourceRef" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignMapFeature_campaignMapId_fkey" FOREIGN KEY ("campaignMapId") REFERENCES "CampaignMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignMapGlossaryLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignMapId" TEXT NOT NULL,
    "mapFeatureId" TEXT NOT NULL,
    "glossaryEntryId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMapGlossaryLink_campaignMapId_fkey" FOREIGN KEY ("campaignMapId") REFERENCES "CampaignMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignMapGlossaryLink_mapFeatureId_fkey" FOREIGN KEY ("mapFeatureId") REFERENCES "CampaignMapFeature" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignMapGlossaryLink_glossaryEntryId_fkey" FOREIGN KEY ("glossaryEntryId") REFERENCES "GlossaryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlossaryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceMapId" TEXT,
    "sourceMapFeatureId" TEXT,
    CONSTRAINT "GlossaryEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GlossaryEntry_sourceMapId_fkey" FOREIGN KEY ("sourceMapId") REFERENCES "CampaignMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GlossaryEntry_sourceMapFeatureId_fkey" FOREIGN KEY ("sourceMapFeatureId") REFERENCES "CampaignMapFeature" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GlossaryEntry" ("aliases", "campaignId", "createdAt", "description", "id", "name", "type", "updatedAt") SELECT "aliases", "campaignId", "createdAt", "description", "id", "name", "type", "updatedAt" FROM "GlossaryEntry";
DROP TABLE "GlossaryEntry";
ALTER TABLE "new_GlossaryEntry" RENAME TO "GlossaryEntry";
CREATE INDEX "GlossaryEntry_campaignId_type_idx" ON "GlossaryEntry"("campaignId", "type");
CREATE INDEX "GlossaryEntry_sourceMapId_idx" ON "GlossaryEntry"("sourceMapId");
CREATE INDEX "GlossaryEntry_sourceMapFeatureId_idx" ON "GlossaryEntry"("sourceMapFeatureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CampaignMap_campaignId_idx" ON "CampaignMap"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMap_campaignId_isPrimary_idx" ON "CampaignMap"("campaignId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMap_campaignId_slug_key" ON "CampaignMap"("campaignId", "slug");

-- CreateIndex
CREATE INDEX "CampaignMapFile_campaignMapId_idx" ON "CampaignMapFile"("campaignMapId");

-- CreateIndex
CREATE INDEX "CampaignMapFile_kind_idx" ON "CampaignMapFile"("kind");

-- CreateIndex
CREATE INDEX "CampaignMapFeature_campaignMapId_idx" ON "CampaignMapFeature"("campaignMapId");

-- CreateIndex
CREATE INDEX "CampaignMapFeature_campaignMapId_featureType_idx" ON "CampaignMapFeature"("campaignMapId", "featureType");

-- CreateIndex
CREATE INDEX "CampaignMapFeature_campaignMapId_normalizedName_idx" ON "CampaignMapFeature"("campaignMapId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMapFeature_campaignMapId_featureType_externalId_key" ON "CampaignMapFeature"("campaignMapId", "featureType", "externalId");

-- CreateIndex
CREATE INDEX "CampaignMapGlossaryLink_campaignMapId_idx" ON "CampaignMapGlossaryLink"("campaignMapId");

-- CreateIndex
CREATE INDEX "CampaignMapGlossaryLink_glossaryEntryId_idx" ON "CampaignMapGlossaryLink"("glossaryEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMapGlossaryLink_mapFeatureId_glossaryEntryId_key" ON "CampaignMapGlossaryLink"("mapFeatureId", "glossaryEntryId");
