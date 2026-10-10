-- AlterTable
ALTER TABLE "PointsEntry" ADD COLUMN "inviteOrderId" TEXT;

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
    "referrerId" TEXT,
    CONSTRAINT "PromoCode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PromoCode_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PromoCode" ("active", "amountCents", "balanceCents", "code", "createdAt", "expiresAt", "id", "initialCents", "kind", "maxUses", "minOrderCents", "note", "ownerId", "percentOff", "pin", "rewardOrderId", "savedAt", "updatedAt", "uses") SELECT "active", "amountCents", "balanceCents", "code", "createdAt", "expiresAt", "id", "initialCents", "kind", "maxUses", "minOrderCents", "note", "ownerId", "percentOff", "pin", "rewardOrderId", "savedAt", "updatedAt", "uses" FROM "PromoCode";
DROP TABLE "PromoCode";
ALTER TABLE "new_PromoCode" RENAME TO "PromoCode";
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE UNIQUE INDEX "PromoCode_rewardOrderId_key" ON "PromoCode"("rewardOrderId");
CREATE UNIQUE INDEX "PromoCode_referrerId_key" ON "PromoCode"("referrerId");
CREATE INDEX "PromoCode_ownerId_idx" ON "PromoCode"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_inviteOrderId_key" ON "PointsEntry"("inviteOrderId");

