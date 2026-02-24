-- CreateTable
CREATE TABLE "CampaignEncounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMBAT',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "visibility" TEXT NOT NULL DEFAULT 'SHARED',
    "notes" TEXT,
    "calendarYear" INTEGER,
    "calendarMonth" INTEGER,
    "calendarDay" INTEGER,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignEncounter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignEncounter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignEncounter_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterCombatant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'ENEMY',
    "sourceType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "sourceCampaignCharacterId" TEXT,
    "sourcePlayerCharacterId" TEXT,
    "sourceGlossaryEntryId" TEXT,
    "sourceStatBlockId" TEXT,
    "initiative" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "maxHp" INTEGER,
    "currentHp" INTEGER,
    "tempHp" INTEGER NOT NULL DEFAULT 0,
    "armorClass" INTEGER,
    "speed" INTEGER,
    "isConcentrating" BOOLEAN NOT NULL DEFAULT false,
    "deathSaveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "deathSaveFailures" INTEGER NOT NULL DEFAULT 0,
    "isDefeated" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterCombatant_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "CampaignEncounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "combatantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER,
    "remaining" INTEGER,
    "tickTiming" TEXT NOT NULL DEFAULT 'TURN_END',
    "source" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterCondition_combatantId_fkey" FOREIGN KEY ("combatantId") REFERENCES "EncounterCombatant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EncounterEvent_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "CampaignEncounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMBAT',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterTemplate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterTemplateCombatant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'ENEMY',
    "sourceType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "sourceStatBlockId" TEXT,
    "maxHp" INTEGER,
    "armorClass" INTEGER,
    "speed" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterTemplateCombatant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EncounterTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterStatBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "challengeRating" TEXT,
    "statBlockJson" JSONB NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterStatBlock_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterStatBlock_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignEncounter_campaignId_createdAt_idx" ON "CampaignEncounter"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignEncounter_campaignId_status_updatedAt_idx" ON "CampaignEncounter"("campaignId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CampaignEncounter_sessionId_idx" ON "CampaignEncounter"("sessionId");

-- CreateIndex
CREATE INDEX "CampaignEncounter_createdByUserId_idx" ON "CampaignEncounter"("createdByUserId");

-- CreateIndex
CREATE INDEX "EncounterCombatant_encounterId_sortOrder_idx" ON "EncounterCombatant"("encounterId", "sortOrder");

-- CreateIndex
CREATE INDEX "EncounterCombatant_encounterId_initiative_idx" ON "EncounterCombatant"("encounterId", "initiative");

-- CreateIndex
CREATE INDEX "EncounterCombatant_sourceStatBlockId_idx" ON "EncounterCombatant"("sourceStatBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterCombatant_encounterId_sortOrder_key" ON "EncounterCombatant"("encounterId", "sortOrder");

-- CreateIndex
CREATE INDEX "EncounterCondition_combatantId_createdAt_idx" ON "EncounterCondition"("combatantId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterEvent_encounterId_createdAt_idx" ON "EncounterEvent"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterEvent_eventType_createdAt_idx" ON "EncounterEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterEvent_createdByUserId_idx" ON "EncounterEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "EncounterTemplate_campaignId_createdAt_idx" ON "EncounterTemplate"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterTemplate_createdByUserId_idx" ON "EncounterTemplate"("createdByUserId");

-- CreateIndex
CREATE INDEX "EncounterTemplateCombatant_templateId_sortOrder_idx" ON "EncounterTemplateCombatant"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterTemplateCombatant_templateId_sortOrder_key" ON "EncounterTemplateCombatant"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "EncounterStatBlock_campaignId_createdAt_idx" ON "EncounterStatBlock"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterStatBlock_createdByUserId_idx" ON "EncounterStatBlock"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterStatBlock_campaignId_name_key" ON "EncounterStatBlock"("campaignId", "name");