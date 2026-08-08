/*
  Warnings:

  - A unique constraint covering the columns `[companyId,clientReferenceId]` on the table `sale` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "clientCreatedAt" TIMESTAMP(3),
ADD COLUMN     "clientReferenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sale_companyId_clientReferenceId_key" ON "sale"("companyId", "clientReferenceId");
