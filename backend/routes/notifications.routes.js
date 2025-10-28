const express = require("express");
const supabase = require("../db");
const { createNotificationForAllUsers } = require("../untils/notify");
const verifyToken = require("../middlewares/verifyUser");
const router = express.Router();

router.use(verifyToken);
/**
 * Helper to extract numeric userId.
 * Supports: ?userId= query or cookie.
 */
function resolveNumericUserId(req) {
  const raw = (req.query?.userId ?? req.cookies?.userId ?? "").toString().trim();
  if (!raw.length) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/** 
 * 🔹 GET /api/notifications 
 * Fetch notifications for a specific user
 */
router.get("/", async (req, res) => {
  try {
    const user_id = resolveNumericUserId(req);
    if (!user_id) return res.json({ items: [], unseen_count: 0 });

    const { data, error } = await supabase
      .from("user_notifications")
      .select(
        `
        id,
        notification_id,
        is_read,
        seen_at,
        notifications (
          id,
          title,
          message,
          link,
          created_at
        )
      `
      )
      .eq("user_id", user_id)
      .order("notifications(created_at)", { ascending: false });

    if (error) throw error;

    // Map into clean structure for frontend
    const formatted = (data || []).map((row) => {
      const n = row.notifications || {};
      const notificationId = row.notification_id || n.id || row.id;
      return {
        id: notificationId,
        notification_id: notificationId,
        entry_id: row.id,
        title: n.title || "",
        message: n.message || "",
        link: n.link || null,
        created_at: n.created_at || null,
        is_read: Boolean(row.is_read),
        seen_at: row.seen_at || null,
      };
    });

    const unseenCount = formatted.filter((n) => !n.is_read).length;

    res.json({ items: formatted, unseen_count: unseenCount });
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/** 
 * 🔹 POST /api/notifications 
 * Create a new notification for all users (Admin use)
 */
router.post("/", async (req, res) => {
  try {
    const { title, message, link } = req.body;
    if (!title || !message)
      return res.status(400).json({ error: "title and message required" });

    await createNotificationForAllUsers(title, message, link);
    res.status(201).json({ success: true, message: "Notification sent to all users" });
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

/** 
 * 🔹 PATCH /api/notifications/:id/read 
 * Mark a single notification as read for this specific user
 */
router.patch("/:id/read", async (req, res) => {
  try {
    const user_id = resolveNumericUserId(req);
    const notification_id = req.params.id;

    if (!user_id) {
      return res.status(401).json({ error: "Valid numeric userId is required" });
    }

    const { error } = await supabase
      .from("user_notifications")
      .update({
        is_read: true,
        seen_at: new Date().toISOString(),
      })
      .eq("user_id", user_id)
      .eq("notification_id", notification_id);

    if (error) throw error;

    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("❌ Error marking notification as read:", err.message);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

module.exports = router;
module.exports.resolveNumericUserId = resolveNumericUserId;
