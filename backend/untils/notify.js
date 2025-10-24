// backend/utils/notify.js
const supabase = require("../db"); // ✅ Supabase client, not pg Pool

async function createNotification(user_id, title, message, link = null) {
  try {
    const { error } = await supabase.from("notifications").insert([
      {
        user_id,
        title,
        message,
        link,
        is_read: false,
      },
    ]);

    if (error) throw error;

    console.log(`🔔 Notification created for ${user_id}`);
  } catch (err) {
    console.error("❌ Error sending notification:", err.message);
  }
}

module.exports = { createNotification };
