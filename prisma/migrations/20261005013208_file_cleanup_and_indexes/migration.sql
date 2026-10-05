-- AlterTable
ALTER TABLE "Upload" ADD COLUMN "fileDeletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Upload_createdAt_idx" ON "Upload"("createdAt");
