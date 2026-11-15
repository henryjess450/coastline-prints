-- More option lists on a product (cord colour, plug...), beside the main one.
ALTER TABLE "ShopProduct" ADD COLUMN "optionSets" TEXT NOT NULL DEFAULT '[]';
