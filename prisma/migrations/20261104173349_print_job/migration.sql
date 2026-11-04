-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenAt" DATETIME,
    "doneAt" DATETIME
);

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");
