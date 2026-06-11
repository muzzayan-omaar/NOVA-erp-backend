import prisma from '../lib/prisma.js';

const createAuditLog = async ({ userId, action, entityType, entityId, metadata }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
};

export default createAuditLog;