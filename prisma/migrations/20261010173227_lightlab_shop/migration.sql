-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL DEFAULT 'lightlab',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "stock" INTEGER,
    "variants" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "sizeXMm" REAL NOT NULL DEFAULT 150,
    "sizeYMm" REAL NOT NULL DEFAULT 150,
    "sizeZMm" REAL NOT NULL DEFAULT 150,
    "grams" REAL NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "uploadId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "fileName" TEXT NOT NULL,
    "unitFactor" REAL NOT NULL DEFAULT 1,
    "scaleX" REAL NOT NULL,
    "scaleY" REAL NOT NULL,
    "scaleZ" REAL NOT NULL,
    "orientation" INTEGER NOT NULL,
    "sizeX" REAL NOT NULL,
    "sizeY" REAL NOT NULL,
    "sizeZ" REAL NOT NULL,
    "material" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorSlots" TEXT,
    "quality" TEXT NOT NULL,
    "infill" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "printerId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "gramsEach" REAL NOT NULL,
    "hoursEach" REAL NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "lineCents" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("colorId", "colorName", "colorSlots", "fileName", "gramsEach", "hoursEach", "id", "infill", "lineCents", "material", "orderId", "orientation", "printerId", "printerName", "quality", "quantity", "scaleX", "scaleY", "scaleZ", "sizeX", "sizeY", "sizeZ", "unitCents", "unitFactor", "uploadId") SELECT "colorId", "colorName", "colorSlots", "fileName", "gramsEach", "hoursEach", "id", "infill", "lineCents", "material", "orderId", "orientation", "printerId", "printerName", "quality", "quantity", "scaleX", "scaleY", "scaleZ", "sizeX", "sizeY", "sizeZ", "unitCents", "unitFactor", "uploadId" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_printerId_idx" ON "OrderItem"("printerId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_shop_active_sortOrder_idx" ON "ShopProduct"("shop", "active", "sortOrder");
