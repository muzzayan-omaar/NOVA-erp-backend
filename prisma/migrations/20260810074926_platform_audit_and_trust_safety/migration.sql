-- CreateTable
CREATE TABLE "platform_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platformAdminId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "platform_admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
