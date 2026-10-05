-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountCents" INTEGER,
    "initialCents" INTEGER,
    "balanceCents" INTEGER,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CodeRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeId" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeRedemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "PromoCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CodeRedemption_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "squarePaymentId" TEXT,
    "squareCustomerId" TEXT,
    "appliedCodes" TEXT NOT NULL DEFAULT '[]',
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Checkout" ("cart", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "failureReason", "id", "idempotencyKey", "notes", "pickupDate", "pickupTime", "squarePaymentId", "status", "totalCents", "updatedAt") SELECT "cart", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "failureReason", "id", "idempotencyKey", "notes", "pickupDate", "pickupTime", "squarePaymentId", "status", "totalCents", "updatedAt" FROM "Checkout";
DROP TABLE "Checkout";
ALTER TABLE "new_Checkout" RENAME TO "Checkout";
CREATE UNIQUE INDEX "Checkout_idempotencyKey_key" ON "Checkout"("idempotencyKey");
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
    "subtotalCents" INTEGER NOT NULL,
    "baseFeeCents" INTEGER NOT NULL,
    "minimumAdjCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "appliedCodes" TEXT NOT NULL DEFAULT '[]',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
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
INSERT INTO "new_Order" ("baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "id", "minimumAdjCents", "notes", "orderNumber", "pickupDate", "pickupTime", "receiptUrl", "squarePaymentId", "status", "subtotalCents", "totalCents", "updatedAt", "viewToken") SELECT "baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "id", "minimumAdjCents", "notes", "orderNumber", "pickupDate", "pickupTime", "receiptUrl", "squarePaymentId", "status", "subtotalCents", "totalCents", "updatedAt", "viewToken" FROM "Order";
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
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "CodeRedemption_checkoutId_idx" ON "CodeRedemption"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeRedemption_codeId_checkoutId_key" ON "CodeRedemption"("codeId", "checkoutId");
