-- AlterTable
ALTER TABLE "LampCommission" ADD COLUMN "cardCheckoutId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LampCommission_cardCheckoutId_key" ON "LampCommission"("cardCheckoutId");
