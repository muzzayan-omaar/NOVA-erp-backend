-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('OPERATING', 'CAPITAL');

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "expenseType" "ExpenseType" NOT NULL DEFAULT 'OPERATING';
