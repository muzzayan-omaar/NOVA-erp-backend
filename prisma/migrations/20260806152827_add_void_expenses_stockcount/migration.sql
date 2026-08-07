-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('OPEN', 'COMPLETED');

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "authorizedById" UUID,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" UUID;

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "stock_count_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockCountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "systemQuantity" DOUBLE PRECISION NOT NULL,
    "countedQuantity" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,

    CONSTRAINT "stock_count_item_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_item" ADD CONSTRAINT "stock_count_item_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_count"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_item" ADD CONSTRAINT "stock_count_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
