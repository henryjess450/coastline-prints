-- CreateTable
CREATE TABLE "LampEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anim" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LampEvent_createdAt_idx" ON "LampEvent"("createdAt");
