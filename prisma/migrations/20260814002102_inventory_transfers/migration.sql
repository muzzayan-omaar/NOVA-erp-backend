-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_IN';

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "linkedFamilyId" UUID;

-- CreateIndex
CREATE INDEX "product_companyId_linkedFamilyId_idx" ON "product"("companyId", "linkedFamilyId");
