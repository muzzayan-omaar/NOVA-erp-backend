/*
  Warnings:

  - A unique constraint covering the columns `[storeCode]` on the table `store` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "store" ADD COLUMN     "storeCode" TEXT;

-- CreateTable
CREATE TABLE "employee_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "staffId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "nationalIdType" TEXT,
    "nationalIdNumber" TEXT,
    "educationLevel" TEXT,
    "position" TEXT,
    "shift" TEXT,
    "photoUrl" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "hireDate" TIMESTAMP(3),
    "defaultBasicSalary" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_profile_userId_key" ON "employee_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profile_staffId_key" ON "employee_profile"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "store_storeCode_key" ON "store"("storeCode");

-- AddForeignKey
ALTER TABLE "employee_profile" ADD CONSTRAINT "employee_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
