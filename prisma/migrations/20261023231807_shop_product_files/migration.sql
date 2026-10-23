-- CreateTable
CREATE TABLE "ShopProductFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopProductFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductFile_storageKey_key" ON "ShopProductFile"("storageKey");

-- CreateIndex
CREATE INDEX "ShopProductFile_productId_idx" ON "ShopProductFile"("productId");
