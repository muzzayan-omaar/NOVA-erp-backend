import prisma from "../lib/prisma.js";

const createPlatformAuditLog = async ({ platformAdminId, action, entityType, entityId, metadata }) => {
  try {
    await prisma.platformAuditLog.create({
      data: { platformAdminId, action, entityType, entityId, metadata },
    });
  } catch (error) {
    console.error("Platform audit log failed:", error);
  }
};

export default createPlatformAuditLog;