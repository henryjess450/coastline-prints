-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN "pickupDate" TEXT;
ALTER TABLE "Checkout" ADD COLUMN "pickupTime" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupDate" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupTime" TEXT;
