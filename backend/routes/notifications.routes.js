const express = require("express");
const supabase = require("../db");
const { createNotificationForAllUsers } = require("../untils/notify"); // ✅ make sure path is correct

const router = express.Router();

function resolveNumericUserId(req) {
  const raw = (req.query?.userId ?? req.cookies?.userId ?? "").toString().trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/* -------------------------------------------
 🌸  GET — Fetch notifications for a specific user
-------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const user_id = resolveNumericUserId(req);
    if (!user_id) return res.json([]);

    const { data, error } = await supabase
      .from("user_notifications")
      .select(
        `
        id,
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

    const formatted = (data || []).map((row) => ({
      id: row.notifications.id,
      title: row.notifications.title,
      message: row.notifications.message,
      link: row.notifications.link,
      created_at: row.notifications.created_at,
      is_read: row.is_read,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/* -------------------------------------------
 🌼  POST — Create new notification for all users
 (For admin use)
-------------------------------------------- */
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

/* -------------------------------------------
 🌻  PATCH — Mark a notification as read
 (specific to logged-in user)
-------------------------------------------- */
router.patch("/:id/read", async (req, res) => {
  try {
    const user_id = resolveNumericUserId(req);
    const notification_id = req.params.id;

    if (!user_id) return res.status(401).json({ error: "Valid numeric userId is required" });

    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true, seen_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("notification_id", notification_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error marking notification as read:", err.message);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

module.exports = router;
