/*
  Warnings:

  - You are about to drop the column `plan` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the `plan` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "plan",
ADD COLUMN     "packageId" UUID;

-- DropTable
DROP TABLE "plan";

-- CreateTable
CREATE TABLE "bundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featureKeys" TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "maxStores" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_bundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "packageId" UUID NOT NULL,
    "bundleId" UUID NOT NULL,

    CONSTRAINT "package_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_cycle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payMonths" INTEGER NOT NULL,
    "bonusMonths" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "billing_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "bundleId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bundle_code_key" ON "bundle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_code_key" ON "package"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_bundle_packageId_bundleId_key" ON "package_bundle"("packageId", "bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycle_code_key" ON "billing_cycle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "company_bundle_companyId_bundleId_key" ON "company_bundle"("companyId", "bundleId");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bundle" ADD CONSTRAINT "company_bundle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bundle" ADD CONSTRAINT "company_bundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
