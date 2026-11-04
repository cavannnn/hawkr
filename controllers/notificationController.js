const Notification = require("../models/notificationModel");

async function getNotifications(req, res) {
  const vendorId = req.params.id;
  try {
    await Notification.generateNotifications(vendorId);
    const [notifications, unreadCount] = await Promise.all([
      Notification.getNotificationsForVendor(vendorId),
      Notification.getUnreadCount(vendorId)
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: err.message });
  }
}

async function markRead(req, res) {
  const vendorId = req.params.id;
  const { notificationId } = req.params;
  try {
    const updated = await Notification.markAsRead(vendorId, notificationId);
    if (!updated) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Marked as read." });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ message: err.message });
  }
}

async function markAllRead(req, res) {
  const vendorId = req.params.id;
  try {
    await Notification.markAllAsRead(vendorId);
    res.json({ message: "All notifications marked as read." });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deleteNotification(req, res) {
  const vendorId = req.params.id;
  const { notificationId } = req.params;
  try {
    const deleted = await Notification.deleteNotification(vendorId, notificationId);
    if (!deleted) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification removed." });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
