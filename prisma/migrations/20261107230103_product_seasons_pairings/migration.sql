-- Seasons, off-season hiding and hand-picked pairings for shop products.
ALTER TABLE "ShopProduct" ADD COLUMN "seasons" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ShopProduct" ADD COLUMN "seasonOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopProduct" ADD COLUMN "pairings" TEXT NOT NULL DEFAULT '[]';
