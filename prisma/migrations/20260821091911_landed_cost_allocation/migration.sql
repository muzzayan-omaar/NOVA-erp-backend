-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "additionalCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "additionalCostsNotes" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_item" ADD COLUMN     "landedUnitCost" DOUBLE PRECISION;
