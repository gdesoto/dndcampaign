-- CreateTable
CREATE TABLE "CampaignCalendarConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "startingYear" INTEGER NOT NULL,
    "firstWeekdayIndex" INTEGER NOT NULL,
    "currentYear" INTEGER NOT NULL,
    "currentMonth" INTEGER NOT NULL,
    "currentDay" INTEGER NOT NULL,
    "weekdaysJson" JSONB NOT NULL,
    "monthsJson" JSONB NOT NULL,
    "moonsJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCalendarConfig_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionCalendarRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionCalendarRange_sessionId_campaignId_fkey" FOREIGN KEY ("sessionId", "campaignId") REFERENCES "Session" ("id", "campaignId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCalendarRange_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignCalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCalendarEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignCalendarEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCalendarConfig_campaignId_key" ON "CampaignCalendarConfig"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignCalendarConfig_campaignId_isEnabled_idx" ON "CampaignCalendarConfig"("campaignId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCalendarRange_sessionId_key" ON "SessionCalendarRange"("sessionId");

-- CreateIndex
CREATE INDEX "SessionCalendarRange_campaignId_idx" ON "SessionCalendarRange"("campaignId");

-- CreateIndex
CREATE INDEX "SessionCalendarRange_campaignId_startYear_startMonth_startDay_idx" ON "SessionCalendarRange"("campaignId", "startYear", "startMonth", "startDay");

-- CreateIndex
CREATE INDEX "SessionCalendarRange_campaignId_endYear_endMonth_endDay_idx" ON "SessionCalendarRange"("campaignId", "endYear", "endMonth", "endDay");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCalendarRange_sessionId_campaignId_key" ON "SessionCalendarRange"("sessionId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignCalendarEvent_campaignId_year_month_day_idx" ON "CampaignCalendarEvent"("campaignId", "year", "month", "day");

-- CreateIndex
CREATE INDEX "CampaignCalendarEvent_campaignId_createdAt_idx" ON "CampaignCalendarEvent"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignCalendarEvent_createdByUserId_idx" ON "CampaignCalendarEvent"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_campaignId_key" ON "Session"("id", "campaignId");

