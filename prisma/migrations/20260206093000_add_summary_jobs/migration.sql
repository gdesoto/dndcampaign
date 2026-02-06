-- CreateTable
CREATE TABLE "SummaryJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "summaryDocumentId" TEXT,
    "trackingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "promptProfile" TEXT,
    "webhookUrl" TEXT,
    "requestHash" TEXT,
    "responseHash" TEXT,
    "errorMessage" TEXT,
    "meta" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SummaryJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SummaryJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SummaryJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SummaryJob_summaryDocumentId_fkey" FOREIGN KEY ("summaryDocumentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SummarySuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summaryJobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "match" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SummarySuggestion_summaryJobId_fkey" FOREIGN KEY ("summaryJobId") REFERENCES "SummaryJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SummaryJob_trackingId_key" ON "SummaryJob"("trackingId");

-- CreateIndex
CREATE INDEX "SummaryJob_campaignId_idx" ON "SummaryJob"("campaignId");

-- CreateIndex
CREATE INDEX "SummaryJob_sessionId_idx" ON "SummaryJob"("sessionId");

-- CreateIndex
CREATE INDEX "SummaryJob_documentId_idx" ON "SummaryJob"("documentId");

-- CreateIndex
CREATE INDEX "SummaryJob_status_idx" ON "SummaryJob"("status");

-- CreateIndex
CREATE INDEX "SummarySuggestion_summaryJobId_idx" ON "SummarySuggestion"("summaryJobId");

-- CreateIndex
CREATE INDEX "SummarySuggestion_status_idx" ON "SummarySuggestion"("status");
