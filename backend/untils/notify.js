const supabase = require("../db");

/**
 * Create a global notification visible to all users.
 * 1. Inserts a new record into `notifications`
 * 2. Creates individual unread entries in `user_notifications`
 */
async function createNotificationForAllUsers(title, message, link = null) {
  try {
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .insert([{ title, message, link }])
      .select("id, title, message, link, created_at")
      .single();

    if (notifError) throw notifError;

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("user_id");

    if (userError) throw userError;
    if (!users || users.length === 0) {
      console.warn("No users found to send notifications.");
      return notif;
    }

    const userEntries = users.map((u) => ({
      user_id: u.user_id,
      notification_id: notif.id,
      is_read: false,
      seen_at: null,
    }));

    const { error: insertError } = await supabase
      .from("user_notifications")
      .insert(userEntries);

    if (insertError) throw insertError;

    return notif;
  } catch (err) {
    console.error("Error creating notification for all users:", err.message);
    return null;
  }
}

async function updateNotificationForLink(link, fields = {}) {
  if (!link) return false;

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(fields, "title")) updates.title = fields.title;
  if (Object.prototype.hasOwnProperty.call(fields, "message")) updates.message = fields.message;
  if (Object.prototype.hasOwnProperty.call(fields, "link")) updates.link = fields.link;

  if (!Object.keys(updates).length) return false;

  try {
    const { data, error } = await supabase
      .from("notifications")
      .update(updates)
      .eq("link", link)
      .select("id");

    if (error) throw error;

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("Error updating notification:", err.message);
    return false;
  }
}

async function deleteNotificationForLink(link) {
  if (!link) return 0;

  try {
    const { data: notifications, error: fetchError } = await supabase
      .from("notifications")
      .select("id")
      .eq("link", link);

    if (fetchError) throw fetchError;

    const ids = Array.isArray(notifications)
      ? notifications.map((n) => n.id).filter(Boolean)
      : [];

    if (!ids.length) return 0;

    const { error: userDeleteError } = await supabase
      .from("user_notifications")
      .delete()
      .in("notification_id", ids);

    if (userDeleteError) throw userDeleteError;

    const { error: notifDeleteError } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids);

    if (notifDeleteError) throw notifDeleteError;

    return ids.length;
  } catch (err) {
    console.error("Error deleting notifications:", err.message);
    return 0;
  }
}

module.exports = {
  createNotificationForAllUsers,
  updateNotificationForLink,
  deleteNotificationForLink,
};
