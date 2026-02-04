-- CreateTable
CREATE TABLE "TranscriptionJob" (
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
    "requestedFormats" TEXT,
    "keyterms" TEXT,
    "errorMessage" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranscriptionJob_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptionArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transcriptionJobId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptionArtifact_transcriptionJobId_fkey" FOREIGN KEY ("transcriptionJobId") REFERENCES "TranscriptionJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranscriptionArtifact_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionJob_externalJobId_key" ON "TranscriptionJob"("externalJobId");

-- CreateIndex
CREATE INDEX "TranscriptionJob_recordingId_idx" ON "TranscriptionJob"("recordingId");

-- CreateIndex
CREATE INDEX "TranscriptionJob_status_idx" ON "TranscriptionJob"("status");

-- CreateIndex
CREATE INDEX "TranscriptionArtifact_artifactId_idx" ON "TranscriptionArtifact"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionArtifact_transcriptionJobId_format_key" ON "TranscriptionArtifact"("transcriptionJobId", "format");
