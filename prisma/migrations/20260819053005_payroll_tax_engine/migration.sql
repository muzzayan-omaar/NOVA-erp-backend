/*
  Warnings:

  - You are about to drop the column `deductions` on the `payroll` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `payroll` table. All the data in the column will be lost.
  - Added the required column `basicSalary` to the `payroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossSalary` to the `payroll` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payroll" DROP COLUMN "deductions",
DROP COLUMN "salary",
ADD COLUMN     "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "basicSalary" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "grossSalary" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "nssfEmployee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "nssfEmployer" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payeTax" DOUBLE PRECISION NOT NULL DEFAULT 0;
