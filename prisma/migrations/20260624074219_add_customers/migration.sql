/*
  Warnings:

  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Made the column `totalCredit` on table `Customer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Customer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_storeId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "email" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "totalCredit" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
