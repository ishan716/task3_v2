const supabase = require("../db");

/**
 * 🌼 Creates a notification visible to all users.
 * 1️⃣ Inserts one record in `notifications`
 * 2️⃣ Creates individual unread entries in `user_notifications`
 */
async function createNotificationForAllUsers(title, message, link = null) {
  try {
    // 1️⃣ Insert into main notifications table
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .insert([{ title, message, link }])
      .select("*")
      .single();

    if (notifError) throw notifError;

    // 2️⃣ Get all users from the users table
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("user_id");

    if (userError) throw userError;

    if (!users || users.length === 0) {
      console.warn("⚠️ No users found to send notification.");
      return;
    }

    // 3️⃣ Create one user_notifications row per user
    const entries = users.map((u) => ({
      user_id: u.user_id,
      notification_id: notif.id,
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from("user_notifications")
      .insert(entries);

    if (insertError) throw insertError;

    console.log(`🔔 Notification "${title}" sent to ${users.length} users`);
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
  }
}

module.exports = { createNotificationForAllUsers };
