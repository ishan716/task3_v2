const supabase = require("../db");

/**
 * 🌼 Create a global notification visible to all users
 * ----------------------------------------------------
 * 1️⃣ Inserts a new record into `notifications`
 * 2️⃣ Creates individual unread entries in `user_notifications`
 */
async function createNotificationForAllUsers(title, message, link = null) {
  try {
    // 🔹 Step 1: Insert notification into main table
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .insert([{ title, message, link }])
      .select("id, title, message, link, created_at")
      .single();

    if (notifError) throw notifError;

    console.log(`✅ Notification created: "${notif.title}" (ID: ${notif.id})`);

    // 🔹 Step 2: Fetch all users (user_id)
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("user_id");

    if (userError) throw userError;
    if (!users || users.length === 0) {
      console.warn("⚠️ No users found to send notifications.");
      return;
    }

    // 🔹 Step 3: Prepare user-specific notification entries
    const userEntries = users.map((u) => ({
      user_id: u.user_id,
      notification_id: notif.id,
      is_read: false,
      seen_at: null,
    }));

    // 🔹 Step 4: Bulk insert into user_notifications
    const { error: insertError } = await supabase
      .from("user_notifications")
      .insert(userEntries);

    if (insertError) throw insertError;

    console.log(`🔔 Notification "${notif.title}" sent to ${users.length} users.`);
  } catch (err) {
    console.error("❌ Error creating notification for all users:", err.message);
  }
}

module.exports = { createNotificationForAllUsers };
