-- CreateEnum
CREATE TYPE "ProductSerialStatus" AS ENUM ('IN_STOCK', 'IN_TRANSIT', 'SOLD', 'RETURNED_DEFECTIVE');

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "isSerialized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_order_item" ADD COLUMN     "productUnitId" UUID,
ADD COLUMN     "unitConversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "quote_item" ADD COLUMN     "productUnitId" UUID,
ADD COLUMN     "unitConversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sale_item" ADD COLUMN     "productUnitId" UUID,
ADD COLUMN     "unitConversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "product_unit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "unitName" TEXT NOT NULL,
    "conversionFactor" DOUBLE PRECISION NOT NULL,
    "barcode" TEXT,
    "sellingPrice" DOUBLE PRECISION,
    "buyingPrice" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_serial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "ProductSerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "saleItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_serial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_unit_companyId_barcode_key" ON "product_unit"("companyId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_serial_saleItemId_key" ON "product_serial"("saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "product_serial_companyId_serialNumber_key" ON "product_serial"("companyId", "serialNumber");

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_unit" ADD CONSTRAINT "product_unit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_unit" ADD CONSTRAINT "product_unit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serial" ADD CONSTRAINT "product_serial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serial" ADD CONSTRAINT "product_serial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serial" ADD CONSTRAINT "product_serial_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serial" ADD CONSTRAINT "product_serial_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
