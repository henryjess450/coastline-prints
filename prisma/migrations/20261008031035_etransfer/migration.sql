-- CreateTable
CREATE TABLE "EtransferDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "senderName" TEXT,
    "memo" TEXT,
    "reference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "checkoutId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Checkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "cart" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "notes" TEXT,
    "pickupDate" TEXT,
    "pickupTime" TEXT,
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "shippingBoxes" TEXT,
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipProvince" TEXT,
    "shipPostal" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CARD',
    "etransferCode" TEXT,
    "etransferDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "squarePaymentId" TEXT,
    "squareCustomerId" TEXT,
    "appliedCodes" TEXT NOT NULL DEFAULT '[]',
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Checkout" ("appliedCodes", "cart", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "discountCents", "failureReason", "fulfillment", "giftCardCents", "id", "idempotencyKey", "notes", "pickupDate", "pickupTime", "shipCity", "shipLine1", "shipLine2", "shipName", "shipPostal", "shipProvince", "shippingBoxes", "shippingCents", "squareCustomerId", "squarePaymentId", "status", "totalCents", "updatedAt") SELECT "appliedCodes", "cart", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "discountCents", "failureReason", "fulfillment", "giftCardCents", "id", "idempotencyKey", "notes", "pickupDate", "pickupTime", "shipCity", "shipLine1", "shipLine2", "shipName", "shipPostal", "shipProvince", "shippingBoxes", "shippingCents", "squareCustomerId", "squarePaymentId", "status", "totalCents", "updatedAt" FROM "Checkout";
DROP TABLE "Checkout";
ALTER TABLE "new_Checkout" RENAME TO "Checkout";
CREATE UNIQUE INDEX "Checkout_idempotencyKey_key" ON "Checkout"("idempotencyKey");
CREATE UNIQUE INDEX "Checkout_etransferCode_key" ON "Checkout"("etransferCode");
CREATE UNIQUE INDEX "Checkout_squarePaymentId_key" ON "Checkout"("squarePaymentId");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "viewToken" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "notes" TEXT,
    "pickupDate" TEXT,
    "pickupTime" TEXT,
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "shippingBoxes" TEXT,
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipProvince" TEXT,
    "shipPostal" TEXT,
    "trackingNumber" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "baseFeeCents" INTEGER NOT NULL,
    "minimumAdjCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "appliedCodes" TEXT NOT NULL DEFAULT '[]',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CARD',
    "etransferDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "squarePaymentId" TEXT NOT NULL,
    "squareCustomerId" TEXT,
    "customerOrderCount" INTEGER NOT NULL DEFAULT 1,
    "receiptUrl" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("appliedCodes", "baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerOrderCount", "customerPhone", "discountCents", "fulfillment", "giftCardCents", "id", "minimumAdjCents", "notes", "orderNumber", "pickupDate", "pickupTime", "receiptUrl", "shipCity", "shipLine1", "shipLine2", "shipName", "shipPostal", "shipProvince", "shippingBoxes", "shippingCents", "squareCustomerId", "squarePaymentId", "status", "subtotalCents", "totalCents", "trackingNumber", "updatedAt", "viewToken") SELECT "appliedCodes", "baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerOrderCount", "customerPhone", "discountCents", "fulfillment", "giftCardCents", "id", "minimumAdjCents", "notes", "orderNumber", "pickupDate", "pickupTime", "receiptUrl", "shipCity", "shipLine1", "shipLine2", "shipName", "shipPostal", "shipProvince", "shippingBoxes", "shippingCents", "squareCustomerId", "squarePaymentId", "status", "subtotalCents", "totalCents", "trackingNumber", "updatedAt", "viewToken" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_viewToken_key" ON "Order"("viewToken");
CREATE UNIQUE INDEX "Order_checkoutId_key" ON "Order"("checkoutId");
CREATE UNIQUE INDEX "Order_squarePaymentId_key" ON "Order"("squarePaymentId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EtransferDeposit_messageId_key" ON "EtransferDeposit"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "EtransferDeposit_checkoutId_key" ON "EtransferDeposit"("checkoutId");

-- CreateIndex
CREATE INDEX "EtransferDeposit_status_idx" ON "EtransferDeposit"("status");
