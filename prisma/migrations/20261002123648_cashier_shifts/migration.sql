-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "shiftId" UUID;

-- CreateTable
CREATE TABLE "cashier_shift" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "openingFloat" DOUBLE PRECISION NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expectedCash" DOUBLE PRECISION,
    "countedCash" DOUBLE PRECISION,
    "cashVariance" DOUBLE PRECISION,
    "totalSales" DOUBLE PRECISION,
    "totalByMethod" JSONB,
    "productMix" JSONB,
    "transactionCount" INTEGER,

    CONSTRAINT "cashier_shift_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cashier_shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
