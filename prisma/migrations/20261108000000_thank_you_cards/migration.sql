-- Printed thank-you cards: which batch a coupon was printed in.
ALTER TABLE "PromoCode" ADD COLUMN "cardBatch" TEXT;
CREATE INDEX "PromoCode_cardBatch_idx" ON "PromoCode"("cardBatch");
