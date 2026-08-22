-- CreateEnum
CREATE TYPE "StockTransitStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'VARIANCE');

-- CreateTable
CREATE TABLE "stock_transit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "sourceStoreId" UUID NOT NULL,
    "targetStoreId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "quantitySent" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION,
    "status" "StockTransitStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "reason" TEXT,
    "dispatchedById" UUID NOT NULL,
    "receivedById" UUID,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_sourceStoreId_fkey" FOREIGN KEY ("sourceStoreId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_targetStoreId_fkey" FOREIGN KEY ("targetStoreId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transit" ADD CONSTRAINT "stock_transit_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
