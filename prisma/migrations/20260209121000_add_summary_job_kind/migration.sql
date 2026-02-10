-- AlterTable
ALTER TABLE "SummaryJob" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SUMMARY_GENERATION';

-- CreateIndex
CREATE INDEX "SummaryJob_kind_idx" ON "SummaryJob"("kind");

-- CreateIndex
CREATE INDEX "SummaryJob_sessionId_kind_createdAt_idx" ON "SummaryJob"("sessionId", "kind", "createdAt");
