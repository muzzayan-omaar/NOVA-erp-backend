import prisma from "../lib/prisma.js";

const createAuditLog = async ({
  userId,
  companyId,
  storeId,
  action,
  entityType,
  entityId,
  metadata,
}) => {
  try {
    if (!companyId) {
      console.error("Audit log skipped: companyId is required", { action, entityType, entityId });
      return;
    }

    await prisma.auditLog.create({
      data: {
        userId,
        companyId,
        storeId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
};

export default createAuditLog;
