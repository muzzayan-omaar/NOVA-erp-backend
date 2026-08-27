-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockCountStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "StockCountStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "stock_count" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedById" UUID;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
