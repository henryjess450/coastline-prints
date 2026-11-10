-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN "giftNote" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "giftNote" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "editionFrom" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "editionTo" INTEGER;

-- CreateTable
CREATE TABLE "WildPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "productId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LampCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "idea" TEXT NOT NULL,
    "shade" TEXT NOT NULL DEFAULT '',
    "shadeHex" TEXT,
    "neededBy" TEXT NOT NULL DEFAULT '',
    "photos" TEXT NOT NULL DEFAULT '[]',
    "quoteCents" INTEGER,
    "quoteNote" TEXT NOT NULL DEFAULT '',
    "quotedAt" DATETIME,
    "acceptedAt" DATETIME,
    "checkoutId" TEXT,
    "payLinkId" TEXT,
    "payLinkUrl" TEXT,
    "payLinkOrder" TEXT,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL DEFAULT 'lightlab',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "personalize" TEXT,
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "stock" INTEGER,
    "variants" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "tagImage" TEXT,
    "tagColors" TEXT NOT NULL DEFAULT '[]',
    "tagPriceColor" TEXT,
    "sizeXMm" REAL NOT NULL DEFAULT 150,
    "sizeYMm" REAL NOT NULL DEFAULT 150,
    "sizeZMm" REAL NOT NULL DEFAULT 150,
    "grams" REAL NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "seasons" TEXT NOT NULL DEFAULT '[]',
    "seasonOnly" BOOLEAN NOT NULL DEFAULT false,
    "pairings" TEXT NOT NULL DEFAULT '[]',
    "addon" BOOLEAN NOT NULL DEFAULT false,
    "editionSize" INTEGER,
    "editionSold" INTEGER NOT NULL DEFAULT 0,
    "dropAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopProduct" ("active", "category", "compareAtCents", "createdAt", "description", "featured", "grams", "id", "images", "name", "pairings", "personalize", "priceCents", "seasonOnly", "seasons", "shop", "sizeXMm", "sizeYMm", "sizeZMm", "slug", "sortOrder", "stock", "tagColors", "tagImage", "tagPriceColor", "tagline", "updatedAt", "variants") SELECT "active", "category", "compareAtCents", "createdAt", "description", "featured", "grams", "id", "images", "name", "pairings", "personalize", "priceCents", "seasonOnly", "seasons", "shop", "sizeXMm", "sizeYMm", "sizeZMm", "slug", "sortOrder", "stock", "tagColors", "tagImage", "tagPriceColor", "tagline", "updatedAt", "variants" FROM "ShopProduct";
DROP TABLE "ShopProduct";
ALTER TABLE "new_ShopProduct" RENAME TO "ShopProduct";
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");
CREATE INDEX "ShopProduct_shop_active_sortOrder_idx" ON "ShopProduct"("shop", "active", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WildPhoto_storageKey_key" ON "WildPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "WildPhoto_active_sortOrder_idx" ON "WildPhoto"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "WildPhoto_productId_idx" ON "WildPhoto"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LampCommission_token_key" ON "LampCommission"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LampCommission_checkoutId_key" ON "LampCommission"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "LampCommission_orderId_key" ON "LampCommission"("orderId");

-- CreateIndex
CREATE INDEX "LampCommission_status_createdAt_idx" ON "LampCommission"("status", "createdAt");
