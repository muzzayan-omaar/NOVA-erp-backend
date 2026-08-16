-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "supplierId" UUID;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
