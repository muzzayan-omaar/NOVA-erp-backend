-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('ACTIVE', 'OFF', 'HOLIDAY', 'EMERGENCY_LEAVE');

-- AlterTable
ALTER TABLE "employee_profile" ADD COLUMN     "workStatus" "WorkStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "workStatusUpdatedAt" TIMESTAMP(3);
