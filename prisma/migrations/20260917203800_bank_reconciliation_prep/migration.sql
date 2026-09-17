-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "method" "PaymentMethod";
