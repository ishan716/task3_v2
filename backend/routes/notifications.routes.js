const express = require("express");
const supabase = require("../db"); // ✅ use supabase, not pool
const router = express.Router();
const { createNotification } = require("../untils/notify"); // ✅ corrected path (utils not untils)

// 🔹 Get all notifications (public/system for now)
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .or("user_id.eq.system,user_id.is.null")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// 🔹 Create a new notification
router.post("/", async (req, res) => {
  try {
    const { user_id, title, message, link } = req.body;

    const { data, error } = await supabase
      .from("notifications")
      .insert([{ user_id, title, message, link }])
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// 🔹 Mark notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error marking notification as read:", err.message);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

module.exports = router;
