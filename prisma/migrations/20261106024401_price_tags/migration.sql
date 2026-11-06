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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopProduct" ("active", "category", "compareAtCents", "createdAt", "description", "featured", "grams", "id", "images", "name", "personalize", "priceCents", "shop", "sizeXMm", "sizeYMm", "sizeZMm", "slug", "sortOrder", "stock", "tagline", "updatedAt", "variants") SELECT "active", "category", "compareAtCents", "createdAt", "description", "featured", "grams", "id", "images", "name", "personalize", "priceCents", "shop", "sizeXMm", "sizeYMm", "sizeZMm", "slug", "sortOrder", "stock", "tagline", "updatedAt", "variants" FROM "ShopProduct";
DROP TABLE "ShopProduct";
ALTER TABLE "new_ShopProduct" RENAME TO "ShopProduct";
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");
CREATE INDEX "ShopProduct_shop_active_sortOrder_idx" ON "ShopProduct"("shop", "active", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
