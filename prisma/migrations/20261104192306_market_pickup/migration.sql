-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN "pickupMarketId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupMarketId" TEXT;

-- CreateIndex
CREATE INDEX "Order_pickupMarketId_idx" ON "Order"("pickupMarketId");
