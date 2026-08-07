-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REQUEST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SaleStatus" ADD VALUE 'PENDING_VOID';
ALTER TYPE "SaleStatus" ADD VALUE 'PENDING_REFUND';

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3);
