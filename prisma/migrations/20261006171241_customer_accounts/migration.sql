-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "pin" TEXT,
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
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT,
    "savedAt" DATETIME,
    "rewardOrderId" TEXT,
    CONSTRAINT "PromoCode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PromoCode" ("active", "amountCents", "balanceCents", "code", "createdAt", "expiresAt", "id", "initialCents", "kind", "maxUses", "minOrderCents", "note", "percentOff", "pin", "updatedAt", "uses") SELECT "active", "amountCents", "balanceCents", "code", "createdAt", "expiresAt", "id", "initialCents", "kind", "maxUses", "minOrderCents", "note", "percentOff", "pin", "updatedAt", "uses" FROM "PromoCode";
DROP TABLE "PromoCode";
ALTER TABLE "new_PromoCode" RENAME TO "PromoCode";
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE UNIQUE INDEX "PromoCode_rewardOrderId_key" ON "PromoCode"("rewardOrderId");
CREATE INDEX "PromoCode_ownerId_idx" ON "PromoCode"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");
