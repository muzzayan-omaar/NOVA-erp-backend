-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_submittedById_fkey";

-- AlterTable
ALTER TABLE "payment" ALTER COLUMN "submittedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
