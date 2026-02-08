-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TranscriptionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestId" TEXT,
    "externalJobId" TEXT,
    "modelId" TEXT,
    "languageCode" TEXT,
    "numSpeakers" INTEGER,
    "diarize" BOOLEAN NOT NULL DEFAULT true,
    "tagAudioEvents" BOOLEAN NOT NULL DEFAULT false,
    "requestedFormats" TEXT,
    "keyterms" TEXT,
    "errorMessage" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranscriptionJob_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TranscriptionJob" ("completedAt", "createdAt", "diarize", "errorMessage", "externalJobId", "id", "keyterms", "languageCode", "modelId", "numSpeakers", "provider", "recordingId", "requestId", "requestedFormats", "status", "updatedAt") SELECT "completedAt", "createdAt", "diarize", "errorMessage", "externalJobId", "id", "keyterms", "languageCode", "modelId", "numSpeakers", "provider", "recordingId", "requestId", "requestedFormats", "status", "updatedAt" FROM "TranscriptionJob";
DROP TABLE "TranscriptionJob";
ALTER TABLE "new_TranscriptionJob" RENAME TO "TranscriptionJob";
CREATE UNIQUE INDEX "TranscriptionJob_externalJobId_key" ON "TranscriptionJob"("externalJobId");
CREATE INDEX "TranscriptionJob_recordingId_idx" ON "TranscriptionJob"("recordingId");
CREATE INDEX "TranscriptionJob_status_idx" ON "TranscriptionJob"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
