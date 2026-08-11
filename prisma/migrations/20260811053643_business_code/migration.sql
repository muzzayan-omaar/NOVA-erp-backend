/*
  Warnings:

  - A unique constraint covering the columns `[businessCode]` on the table `company` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "company" ADD COLUMN     "businessCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "company_businessCode_key" ON "company"("businessCode");
