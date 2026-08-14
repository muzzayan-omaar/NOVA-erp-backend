import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "./notification.service.js";

export const fetchNotifications = async (req, res) => {
  try {
    const notifications = await getNotifications({
      companyId: req.context.companyId,
      userId: req.context.userId,
      storeId: req.context.storeId,
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const unreadNotifications = async (req, res) => {
  try {
    const count = await getUnreadCount({
      companyId: req.context.companyId,
      userId: req.context.userId,
      storeId: req.context.storeId,
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const readNotification = async (req, res) => {
  try {
    const notification = await markAsRead(req.params.id);
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const readAllNotifications = async (req, res) => {
  try {
    await markAllAsRead({
      companyId: req.context.companyId,
      userId: req.context.userId,
      storeId: req.context.storeId,
    });

    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeNotification = async (req, res) => {
  try {
    const result = await deleteNotification({
      id: req.params.id,
      companyId: req.context.companyId,
    });

    if (result.count === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
