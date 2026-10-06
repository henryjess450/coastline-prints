-- CreateTable
CREATE TABLE "GiftPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "GiftPurchase_idempotencyKey_key" ON "GiftPurchase"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPurchase_squarePaymentId_key" ON "GiftPurchase"("squarePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPurchase_codeId_key" ON "GiftPurchase"("codeId");

-- CreateIndex
CREATE INDEX "GiftPurchase_status_deliverAt_idx" ON "GiftPurchase"("status", "deliverAt");
