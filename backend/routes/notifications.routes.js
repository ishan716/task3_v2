const express = require("express");
const supabase = require("../db");
const {
  createNotificationForAllUsers,
  deleteNotificationForLink,
} = require("../untils/notify");
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


function extractEventIdFromLink(link) {
  if (typeof link !== "string") return null;
  const match = link.match(/\/events\/(\d+)/);
  if (!match) return null;
  const eventId = Number(match[1]);
  return Number.isInteger(eventId) && eventId > 0 ? eventId : null;
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
    const mapped = (data || []).map((row) => {
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

    const eventIds = new Map();
    mapped.forEach((n) => {
      const eventId = extractEventIdFromLink(n.link);
      if (eventId) {
        eventIds.set(eventId, n.link);
      }
    });

    let filtered = mapped;

    if (eventIds.size) {
      const ids = Array.from(eventIds.keys());
      const { data: existingEvents, error: fetchEventsError } = await supabase
        .from("events")
        .select("event_id")
        .in("event_id", ids);
      if (fetchEventsError) throw fetchEventsError;

      const existingSet = new Set((existingEvents || []).map((row) => Number(row.event_id)));

      const staleLinks = new Set();
      filtered = mapped.filter((n) => {
        const eventId = extractEventIdFromLink(n.link);
        if (eventId && !existingSet.has(eventId)) {
          if (n.link) staleLinks.add(n.link);
          return false;
        }
        return true;
      });

      for (const link of staleLinks) {
        await deleteNotificationForLink(link);
      }
    }

    const unseenCount = filtered.filter((n) => !n.is_read).length;

    res.json({ items: filtered, unseen_count: unseenCount });
  } catch (err) {
    console.error("Error fetching notifications:", err.message);
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


router.delete("/:id", async (req, res) => {
  try {
    const user_id = resolveNumericUserId(req);
    const notification_id = req.params.id;

    if (!user_id) {
      return res.status(401).json({ error: "Valid numeric userId is required" });
    }

    const { data, error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", user_id)
      .eq("notification_id", notification_id)
      .select("id");

    if (error) throw error;

    res.json({ success: true, removed: Array.isArray(data) ? data.length : 0 });
  } catch (err) {
    console.error("Error deleting notification:", err.message);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

module.exports = router;
