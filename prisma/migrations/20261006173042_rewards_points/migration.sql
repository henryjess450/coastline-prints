-- CreateTable
CREATE TABLE "PointsEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT,
    "prizeId" TEXT,
    "codeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_orderId_key" ON "PointsEntry"("orderId");

-- CreateIndex
CREATE INDEX "PointsEntry_email_idx" ON "PointsEntry"("email");
