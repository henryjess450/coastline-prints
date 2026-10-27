-- CreateTable
CREATE TABLE "PosRegister" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pairCode" TEXT,
    "displayToken" TEXT NOT NULL,
    "pairedAt" DATETIME,
    "screen" TEXT NOT NULL DEFAULT '{"stage":"idle"}',
    "customerEmail" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PosRegister_pairCode_key" ON "PosRegister"("pairCode");

-- CreateIndex
CREATE UNIQUE INDEX "PosRegister_displayToken_key" ON "PosRegister"("displayToken");
