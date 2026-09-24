-- AlterEnum
ALTER TYPE "ProductSerialStatus" ADD VALUE 'LOST';

-- AlterTable
ALTER TABLE "product_serial" ADD COLUMN     "transitId" UUID;

-- AddForeignKey
ALTER TABLE "product_serial" ADD CONSTRAINT "product_serial_transitId_fkey" FOREIGN KEY ("transitId") REFERENCES "stock_transit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
