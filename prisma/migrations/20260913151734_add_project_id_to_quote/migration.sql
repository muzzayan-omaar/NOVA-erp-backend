-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "projectId" UUID;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "customer_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
