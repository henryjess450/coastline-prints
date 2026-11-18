-- Deal of the day at the stand: dollars off one lamp, on one day only (register and kiosk; online prices don't change).
ALTER TABLE "ShopProduct" ADD COLUMN "standDealCents" INTEGER;
ALTER TABLE "ShopProduct" ADD COLUMN "standDealDate" TEXT;
