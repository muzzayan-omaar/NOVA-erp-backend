-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_verifiedById_fkey";

-- CreateTable
CREATE TABLE "platform_admin" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_email_key" ON "platform_admin"("email");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "platform_admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
