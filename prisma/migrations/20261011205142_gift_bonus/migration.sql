-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GiftPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "bonusCents" INTEGER NOT NULL DEFAULT 0,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "message" TEXT,
    "sendOn" TEXT,
    "deliverAt" DATETIME NOT NULL,
    "squarePaymentId" TEXT,
    "receiptUrl" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "failureReason" TEXT,
    "codeId" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GiftPurchase_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "PromoCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GiftPurchase" ("amountCents", "buyerEmail", "buyerName", "cardBrand", "cardLast4", "codeId", "createdAt", "deliverAt", "failureReason", "id", "idempotencyKey", "message", "paidAt", "receiptUrl", "recipientEmail", "recipientName", "sendOn", "squarePaymentId", "status", "updatedAt") SELECT "amountCents", "buyerEmail", "buyerName", "cardBrand", "cardLast4", "codeId", "createdAt", "deliverAt", "failureReason", "id", "idempotencyKey", "message", "paidAt", "receiptUrl", "recipientEmail", "recipientName", "sendOn", "squarePaymentId", "status", "updatedAt" FROM "GiftPurchase";
DROP TABLE "GiftPurchase";
ALTER TABLE "new_GiftPurchase" RENAME TO "GiftPurchase";
CREATE UNIQUE INDEX "GiftPurchase_idempotencyKey_key" ON "GiftPurchase"("idempotencyKey");
CREATE UNIQUE INDEX "GiftPurchase_squarePaymentId_key" ON "GiftPurchase"("squarePaymentId");
CREATE UNIQUE INDEX "GiftPurchase_codeId_key" ON "GiftPurchase"("codeId");
CREATE INDEX "GiftPurchase_status_deliverAt_idx" ON "GiftPurchase"("status", "deliverAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
