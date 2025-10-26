import { useEffect, useState } from "react";
import { apiGet, apiJSON } from "../src/api.js";

// 🪷 Automatically attach logged-in userId to API requests
const withUserQuery = (path) => {
  const userId = localStorage.getItem("user_id"); // 👈 gets from login
  if (!userId) return path;
  const query = `userId=${encodeURIComponent(userId)}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
};

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // 🔹 Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const payload = await apiGet(withUserQuery("/api/notifications"));
      const items = payload?.items || [];
      setNotifications(items);
      setUnreadCount(payload.unseen_count || 0);
      console.log("✅ Notifications loaded:", items);
    } catch (err) {
      console.error("❌ Failed to load notifications", err);
    }
  };

  // 🔹 Mark a notification as read
  const markAsRead = async (id) => {
    try {
      await apiJSON("PATCH", withUserQuery(`/api/notifications/${id}/read`));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, seen_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error("❌ Failed to mark notification as read", err);
    }
  };

  return (
    <div className="relative">
      {/* 🔔 Notification Bell */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg
          className="w-6 h-6 text-gray-700 dark:text-gray-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C8.67 6.165 8 7.388 8 8.75V14l-1.405 1.405A2.032 2.032 0 016 17h9z"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {/* 📋 Notification Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center py-4 text-gray-500 dark:text-gray-400">
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-800 ${
                  n.is_read
                    ? "opacity-70"
                    : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                } transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{n.title}</p>
                  <span
                    className={`text-xs font-semibold ${
                      n.is_read ? "text-gray-500" : "text-green-600"
                    }`}
                  >
                    {n.is_read ? "Seen" : "New"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{n.message}</p>
                {n.link && (
                  <a
                    href={n.link}
                    onClick={() => markAsRead(n.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View details
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
