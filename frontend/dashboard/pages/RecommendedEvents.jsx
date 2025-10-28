import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../src/api.js";
import { useTheme } from "../src/theme/ThemeProvider.jsx";

const RecommendedEvents = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isDark: darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    fetchRecommended();
  }, []);

  const fetchRecommended = async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await apiGet("/api/events/recommended");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      console.error("Failed to load recommended events", e);
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const wrapperClass = darkMode ? "dark" : "";
  const baseScreenClasses = darkMode
    ? "p-6 min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-teal-950 text-gray-100 transition-colors duration-300"
    : "p-6 min-h-screen bg-gray-50 text-gray-900 transition-colors duration-300";

  return (
    <div className={wrapperClass}>
      <div className={baseScreenClasses}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Recommended Events
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchRecommended}
              className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white hover:from-teal-500 hover:via-sky-500 hover:to-indigo-500 dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Refresh
            </button>
            <button
              onClick={toggleTheme}
              aria-pressed={darkMode}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded mb-4 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
            <p className="font-semibold">Failed to load recommendations</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow dark:bg-gray-900 dark:border dark:border-gray-800 dark:shadow-[0_35px_60px_-40px_rgba(0,0,0,0.8)]">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-3 text-xl font-medium text-gray-900 dark:text-gray-100">No recommendations yet</h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">Select your interests to see personalized events.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((ev) => (
              <div
                key={ev.event_id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-800 dark:hover:shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{ev.event_title}</h3>
                {ev.description && <p className="text-gray-700 mb-3 line-clamp-3 dark:text-gray-300">{ev.description}</p>}

                <div className="space-y-2 text-sm mb-3">
                  <div className="flex items-start text-gray-700 dark:text-gray-300">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {formatDate(ev.start_time)}
                      {ev.end_time ? ` - ${formatDate(ev.end_time)}` : ""}
                    </span>
                  </div>
                  {ev.location && (
                    <div className="flex items-start text-gray-700 dark:text-gray-300">
                      <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{ev.location}</span>
                    </div>
                  )}
                </div>

                {Array.isArray(ev.categories) && ev.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ev.categories.map((c) => (
                      <span
                        key={`${ev.event_id}-${c.category_id}`}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/40"
                      >
                        {c.category_name}
                      </span>
                    ))}
                  </div>
                )}

                <Link
                  to={`/events/${ev.event_id}`}
                  className="flex-1 mt-1 w-full inline-block text-center py-3 px-4 rounded-xl font-medium 
                    bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white 
                    hover:from-teal-500 hover:via-sky-500 hover:to-indigo-500 
                    dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500 
                    shadow-md hover:shadow-lg transition-all duration-200 group"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendedEvents;


