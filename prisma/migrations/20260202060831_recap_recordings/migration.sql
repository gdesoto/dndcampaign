-- CreateTable
CREATE TABLE "RecapRecording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "artifactId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecapRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecapRecording_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecapRecording_sessionId_key" ON "RecapRecording"("sessionId");

-- CreateIndex
CREATE INDEX "RecapRecording_sessionId_idx" ON "RecapRecording"("sessionId");

-- CreateIndex
CREATE INDEX "RecapRecording_artifactId_idx" ON "RecapRecording"("artifactId");
