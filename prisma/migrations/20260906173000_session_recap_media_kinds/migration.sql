-- Preserve existing recap rows and artifacts, classifying video uploads by MIME type.
ALTER TABLE "RecapRecording" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'AUDIO';
UPDATE "RecapRecording" SET "kind" = 'VIDEO' WHERE "mimeType" LIKE 'video/%';
DROP INDEX "RecapRecording_sessionId_key";
DROP INDEX "RecapRecording_sessionId_idx";
CREATE UNIQUE INDEX "RecapRecording_sessionId_kind_key" ON "RecapRecording"("sessionId", "kind");
