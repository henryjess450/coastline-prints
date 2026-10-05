/*
  Warnings:

  - Added the required column `viewToken` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "subtotalCents" INTEGER NOT NULL,
    "baseFeeCents" INTEGER NOT NULL,
    "minimumAdjCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "squarePaymentId" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "id", "minimumAdjCents", "notes", "orderNumber", "receiptUrl", "squarePaymentId", "status", "subtotalCents", "totalCents", "updatedAt") SELECT "baseFeeCents", "cardBrand", "cardLast4", "checkoutId", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "id", "minimumAdjCents", "notes", "orderNumber", "receiptUrl", "squarePaymentId", "status", "subtotalCents", "totalCents", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_viewToken_key" ON "Order"("viewToken");
CREATE UNIQUE INDEX "Order_checkoutId_key" ON "Order"("checkoutId");
CREATE UNIQUE INDEX "Order_squarePaymentId_key" ON "Order"("squarePaymentId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
