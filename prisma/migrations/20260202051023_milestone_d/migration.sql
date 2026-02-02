-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT,
    "recordingId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'MARKDOWN',
    "source" TEXT NOT NULL DEFAULT 'USER_EDIT',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "artifactId" TEXT NOT NULL,
    "vttArtifactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recording_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recording_vttArtifactId_fkey" FOREIGN KEY ("vttArtifactId") REFERENCES "Artifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recording" ("artifactId", "byteSize", "createdAt", "durationSeconds", "filename", "id", "kind", "mimeType", "sessionId", "updatedAt") SELECT "artifactId", "byteSize", "createdAt", "durationSeconds", "filename", "id", "kind", "mimeType", "sessionId", "updatedAt" FROM "Recording";
DROP TABLE "Recording";
ALTER TABLE "new_Recording" RENAME TO "Recording";
CREATE INDEX "Recording_sessionId_idx" ON "Recording"("sessionId");
CREATE INDEX "Recording_artifactId_idx" ON "Recording"("artifactId");
CREATE INDEX "Recording_vttArtifactId_idx" ON "Recording"("vttArtifactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");

-- CreateIndex
CREATE INDEX "Document_campaignId_idx" ON "Document"("campaignId");

-- CreateIndex
CREATE INDEX "Document_sessionId_idx" ON "Document"("sessionId");

-- CreateIndex
CREATE INDEX "Document_recordingId_idx" ON "Document"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_sessionId_type_key" ON "Document"("sessionId", "type");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdByUserId_idx" ON "DocumentVersion"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");
