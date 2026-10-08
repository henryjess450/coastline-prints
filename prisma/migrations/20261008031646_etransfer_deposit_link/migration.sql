-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EtransferDeposit" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtransferDeposit_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EtransferDeposit" ("amountCents", "checkoutId", "createdAt", "id", "memo", "messageId", "note", "receivedAt", "reference", "senderName", "status", "verified") SELECT "amountCents", "checkoutId", "createdAt", "id", "memo", "messageId", "note", "receivedAt", "reference", "senderName", "status", "verified" FROM "EtransferDeposit";
DROP TABLE "EtransferDeposit";
ALTER TABLE "new_EtransferDeposit" RENAME TO "EtransferDeposit";
CREATE UNIQUE INDEX "EtransferDeposit_messageId_key" ON "EtransferDeposit"("messageId");
CREATE UNIQUE INDEX "EtransferDeposit_checkoutId_key" ON "EtransferDeposit"("checkoutId");
CREATE INDEX "EtransferDeposit_status_idx" ON "EtransferDeposit"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
