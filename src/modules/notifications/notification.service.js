import prisma from "../../lib/prisma.js";
import { emitNotification } from "./notification.socket.js";

/**
 * CREATE (with optional uniqueKey dedupe)
 */
export const createNotification = async (data) => {
  const existing = data.uniqueKey
    ? await prisma.notification.findUnique({
        where: {
          companyId_uniqueKey: {
            companyId: data.companyId,
            uniqueKey: data.uniqueKey,
          },
        },
      })
    : null;

  if (existing) {
    return existing;
  }

  const notification = await prisma.notification.create({
    data,
  });

  const io = global.io;
  emitNotification(io, notification);

  return notification;
};

/**
 * LIST notifications for a user/company/store
 */
export const getNotifications = async ({ companyId, userId, storeId }) => {
  return prisma.notification.findMany({
    where: {
      companyId,
      AND: [
        {
          OR: [
            { userId }, // personal
            { userId: null }, // company-wide
          ],
        },
        storeId
          ? {
              OR: [
                { storeId },
                { storeId: null }, // company-level
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

/**
 * UNREAD COUNT
 */
export const getUnreadCount = async ({ companyId, userId, storeId }) => {
  return prisma.notification.count({
    where: {
      companyId,
      isRead: false,
      OR: [{ userId }, { userId: null }, ...(storeId ? [{ storeId }] : [])],
    },
  });
};

/**
 * MARK ONE AS READ (with ownership check)
 */
export const markAsRead = async (id, companyId) => {
  try {
    return await prisma.notification.update({
      where: {
        id,
        companyId, // prevents cross-company access
      },
      data: {
        isRead: true,
        // optional: readAt: new Date()
      },
    });
  } catch (error) {
    // Prisma throws P2025 if record not found
    return null;
  }
};

/**
 * MARK ALL AS READ for this user/company
 */
// mark all notifications read
export const markAllAsRead = async ({ companyId, userId, storeId }) => {
  return await prisma.notification.updateMany({
    where: {
      companyId,
      isRead: false,
      OR: [{ userId }, { userId: null, storeId }, { userId: null, storeId: null }],
    },
    data: {
      isRead: true,
    },
  });
};

/**
 * DELETE notification
 */
export const deleteNotification = async (id, companyId) => {
  try {
    return await prisma.notification.delete({
      where: {
        id,
        companyId,
      },
    });
  } catch (error) {
    return null;
  }
};
