-- CreateTable
CREATE TABLE "Kiosk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Kiosk',
    "mode" TEXT NOT NULL DEFAULT 'shop',
    "pairCode" TEXT,
    "token" TEXT NOT NULL,
    "pairedAt" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KioskSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kioskId" TEXT NOT NULL,
    "cart" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "linkId" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "squareOrder" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "needBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderNumber" TEXT,
    "problem" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KioskSale_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "Kiosk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Kiosk_pairCode_key" ON "Kiosk"("pairCode");

-- CreateIndex
CREATE UNIQUE INDEX "Kiosk_token_key" ON "Kiosk"("token");

-- CreateIndex
CREATE INDEX "KioskSale_kioskId_createdAt_idx" ON "KioskSale"("kioskId", "createdAt");

