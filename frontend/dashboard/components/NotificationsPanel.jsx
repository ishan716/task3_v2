import { useEffect, useState } from "react";
import { apiGet, apiJSON } from "../src/api.js";

const DEMO_USER_ID = (import.meta.env.VITE_DEMO_USER_ID || "").trim();
const withUserQuery = (path) => {
  if (!DEMO_USER_ID) return path;
  const query = `userId=${encodeURIComponent(DEMO_USER_ID)}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
};

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  // 🌼 Load notifications when the component mounts
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await apiGet(withUserQuery("/api/notifications"));
      setNotifications(data || []);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  // 🌷 Mark notification as read (only for this user)
  const markAsRead = async (id) => {
    try {
      await apiJSON("PATCH", withUserQuery(`/api/notifications/${id}/read`));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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

      {/* 💌 Dropdown Panel */}
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
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  {n.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {n.message}
                </p>
                {n.link && (
                  <a
                    href={n.link}
                    onClick={() => markAsRead(n.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View →
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
