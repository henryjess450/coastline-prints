-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN "firstSource" TEXT;
ALTER TABLE "Checkout" ADD COLUMN "source" TEXT;
ALTER TABLE "Checkout" ADD COLUMN "sourceDetail" TEXT;

-- AlterTable
ALTER TABLE "GiftPurchase" ADD COLUMN "source" TEXT;
ALTER TABLE "GiftPurchase" ADD COLUMN "sourceDetail" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "firstSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "source" TEXT;
ALTER TABLE "Order" ADD COLUMN "sourceDetail" TEXT;

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");
