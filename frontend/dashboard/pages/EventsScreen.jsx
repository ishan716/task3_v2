import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import InterestsDialog from "../components/InterestsDialog.jsx";
import NotificationsPanel from "../components/NotificationsPanel.jsx";
import { useTheme } from "../src/theme/ThemeProvider.jsx";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EventsScreen = () => {
  const [events, setEvents] = useState([]);  // all events fetched from API
  const [loading, setLoading] = useState(true); // loading state
  const [error, setError] = useState(null); // error state
  const [hoveredEvent, setHoveredEvent] = useState(null); // currently hovered event for UI effects mouse moving over
  const [searchQuery, setSearchQuery] = useState(""); //stores the text typed in the search bar to filter events
  const [interestedMap, setInterestedMap] = useState({}); // keeps track of which events the user marked as "Interested"
  const [myEvents, setMyEvents] = useState(() => {
    const saved = localStorage.getItem("myEvents"); // retrieve saved events from localStorage
    return saved ? JSON.parse(saved) : [];
  });
  const [isMyEventsOpen, setIsMyEventsOpen] = useState(false); // state for "My Events" modal
  const [isEditInterestsOpen, setIsEditInterestsOpen] = useState(false);// state for "Edit Interests" dialog
  const [viewMode, setViewMode] = useState("list"); // "list" or "calendar"
  const [calendarDate, setCalendarDate] = useState(() => new Date()); // current month/year in calendar
  const [isDayEventsOpen, setIsDayEventsOpen] = useState(false); // the popup that shows "events on a specific day" is closed initially
  const [selectedDayInfo, setSelectedDayInfo] = useState(null); // info for the selected day in calendar
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // state for the 3-dot menu dropdown

  const navigate = useNavigate();
  const API_BASE_URL = useMemo(
      () => import.meta.env.VITE_API_URL || "http://localhost:3000",
      []
  );

  // Attach access token to API requests made from this screen
  const getAuthHeaders = () => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { isDark: darkMode, toggleTheme } = useTheme();



  // Helper function for status badges
  const getEventStatus = (start, end) => {
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (now >= startDate && now <= endDate) {
      return { label: "On Going", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200" };
    } else if (now < startDate) {
      return { label: "Up Coming", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200" };
    } else {
      return { label: "Ended", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" };
    }
  };

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events.filter((e) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const title = (e.event_title || "").toLowerCase();
      const desc = (e.description || "").toLowerCase();
      const loc = (e.location || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || loc.includes(q);
    });

    const statusOrder = { "On Going": 0, "Up Coming": 1, "Ended": 2 };
    filtered.sort((a, b) => {
      const statusA = getEventStatus(a.start_time, a.end_time).label;
      const statusB = getEventStatus(b.start_time, b.end_time).label;
      if (statusA === statusB) {
        return new Date(a.start_time) - new Date(b.start_time);
      }
      return statusOrder[statusA] - statusOrder[statusB];
    });

    return filtered;
  }, [events, searchQuery]);

  const eventsByDate = useMemo(() => {
    const map = {};
    filteredAndSortedEvents.forEach((event) => {
      if (!event?.start_time) return;
      const key = new Date(event.start_time).toISOString().split("T")[0];
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(event);
    });
    return map;
  }, [filteredAndSortedEvents]);

  const calendarMatrix = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const start = new Date(monthStart);
    start.setDate(monthStart.getDate() - monthStart.getDay()); //get day means if tuesday its 2 so from this formula it gets nearest sunday

    const weeks = [];
    for (let week = 0; week < 6; week += 1) {
      const days = [];
      for (let day = 0; day < 7; day += 1) {
        const cellDate = new Date(start);
        cellDate.setDate(start.getDate() + week * 7 + day);
        const isoKey = cellDate.toISOString().split("T")[0]; //2021-09-15 like string
        days.push({
          date: cellDate,
          isCurrentMonth: cellDate.getMonth() === month, //boolean
          events: eventsByDate[isoKey] || [],
        });
      }
      weeks.push(days);
    }
    return weeks;
  }, [calendarDate, eventsByDate]);
  const currentMonthLabel = useMemo(
      () =>
          calendarDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
      [calendarDate]
  ); // remembers month year

  useEffect(() => {
    const seen = localStorage.getItem("seenEditInterestsPrompt"); //check if user has seen the prompt before
    if (!seen) {
      setIsEditInterestsOpen(true); //open the dialog if not seen(first time user)
      localStorage.setItem("seenEditInterestsPrompt", "1"); //then mark as seen
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Local wrapper ensures Tailwind's class-based dark variant always has an ancestor
  const wrapperClass = darkMode ? "dark" : "";
  const baseScreenClasses = darkMode 
    ? "events-screen p-6 min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-teal-950 transition-colors duration-300"
    : "events-screen p-6 min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 transition-colors duration-300";

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data || []);

      // Load interested status  (promise.all promise all the fetch calls even one fails it says false)
      if (Array.isArray(data) && data.length) {
        const pairs = await Promise.all(  
            data.map(async (e) => {
              try {
                const r = await fetch(`${API_BASE_URL}/api/interested/status/${e.event_id}`, {
                  credentials: "include",
                  headers: {
                    ...getAuthHeaders(),
                  },
                });
                if (!r.ok) return [e.event_id, false];
                const j = await r.json();
                return [e.event_id, Boolean(j?.interested)];
              } catch {
                return [e.event_id, false];
              }
            })
        );
        setInterestedMap(Object.fromEntries(pairs));
      } else {
        setInterestedMap({});
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
//interested status in ui and backend handling
  const toggleInterested = async (event) => {
    const id = event.event_id; // identify which event is clicked
    const prev = !!interestedMap[id];
    const next = !prev;

    setInterestedMap((m) => ({ ...m, [id]: next }));
    setEvents((list) =>
        list.map((e) =>
            e.event_id === id
                ? {
                  ...e,
                  interested_count: Math.max(
                      Number(e.interested_count || 0) + (next ? 1 : -1),
                      0
                  ),
                }
                : e
        )
    );
// if interested backend post else delete and update interested count 
    try {
      const method = next ? "POST" : "DELETE";
      const r = await fetch(`${API_BASE_URL}/api/interested`, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ event_id: id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json().catch(() => null);
      if (j?.interested_count != null) {
        setEvents((list) =>
            list.map((e) =>
                e.event_id === id ? { ...e, interested_count: j.interested_count } : e
            )
        );
      }
    } catch (e) {
      console.error("Failed to toggle interested:", e);
      setInterestedMap((m) => ({ ...m, [id]: prev }));
      setEvents((list) =>
          list.map((e) =>
              e.event_id === id
                  ? {
                    ...e,
                    interested_count: Math.max(
                        Number(e.interested_count || 0) + (prev ? 1 : -1),
                        0
                    ),
                  }
                  : e
          )
      );
      alert("Sorry, something went wrong. Please try again.");
    }
  };
//handle my events. and save to localstorage sort by date.
  const handleSave = (event) => {
    const exists = myEvents.find((e) => e.event_id === event.event_id);
    let updated;
    if (exists) {
      updated = myEvents.filter((e) => e.event_id !== event.event_id);
    } else {
      updated = [...myEvents, event].sort(
          (a, b) => new Date(a.start_time) - new Date(b.start_time)
      );
    }
    setMyEvents(updated);
    localStorage.setItem("myEvents", JSON.stringify(updated));
    return !exists;
  };
//output nice readable format of date and time
  const formatDate = (dateString) =>
      new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
//creates user friendly time range display
  const formatTimeRange = (start, end) => {
    if (!start) return "";
    const startDate = new Date(start);
    const startLabel = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (!end) return startLabel;
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();
    const endLabel = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return sameDay ? `${startLabel} - ${endLabel}` : `${startLabel} -> ${endLabel}`;
  };
//calendar month navigation
  const handleMonthChange = (offset) => {
    setCalendarDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      return next;
    });
  };
//format day heading for popup
  const formatDayHeading = (date) =>
      date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
//opens the day events popup when a day cell is clicked in calendar
  const openDayEvents = (day) => {
    if (!day?.events?.length) return;
    const sorted = [...day.events].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );
    setSelectedDayInfo({
      date: day.date,
      events: sorted,
    });
    setIsDayEventsOpen(true);
  };

  if (loading)
    return (
        <div className={wrapperClass}>
          <div className={baseScreenClasses}>
            <h2 className="text-2xl font-bold mb-4">Events</h2>
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
    );

  if (error)
    return (
        <div className={wrapperClass}>
          <div className={baseScreenClasses}>
            <h2 className="text-2xl font-bold mb-4">Events</h2>
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded transition-colors duration-300">
              <p className="font-bold">Error loading events:</p>
              <p>{error}</p>
              <button
                  onClick={fetchEvents}
                  className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
    );

  return (
      <div className={wrapperClass}>
        <div className={baseScreenClasses}>
        {/* Header */}

        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Events
            </h2>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title, description, or location..."
                className="w-full md:flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-blue-400 transition-colors duration-200"
            />
            <div className="flex items-center gap-3 md:ml-auto">
              <NotificationsPanel />      
  

            <button
                onClick={toggleTheme}
                aria-pressed={darkMode}
                className="ml-3 px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white transition-all duration-200"
            >  {/* Icon changes based on dark mode state */}
                {darkMode ? (
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
            </button>


              <div className="relative md:ml-auto">
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                    aria-label="Menu"
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
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>

                {isDropdownOpen && (
                    <>
                      <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsDropdownOpen(false)}
                      ></div>

                      <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-20">
                        <div className="py-1">
                          {/* Recommended Events */}
                          <button
                              onClick={() => {
                                navigate("/recommended");
                                setIsDropdownOpen(false);
                              }}
                              className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg
                                className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Recommended Events
                          </button>

                          {/* Edit Interests */}
                          <button
                              onClick={() => {
                                setIsEditInterestsOpen(true);
                                setIsDropdownOpen(false);
                              }}
                              className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg
                                className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Edit Interests
                          </button>

                          {/* My Events */}
                          <button
                              onClick={() => {
                                setIsMyEventsOpen(true);
                                setIsDropdownOpen(false);
                              }}
                              className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg
                                className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                              <path
                                  fillRule="evenodd"
                                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                              />
                            </svg>
                            My Events
                          </button>

                          {/* 🚀 Logout Button */}
                          <button
                              onClick={() => {
                                localStorage.removeItem("accessToken");
                                setIsDropdownOpen(false);
                                navigate("/login");
                              }}
                              className="group flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg
                                className="mr-3 h-5 w-5 text-red-500 group-hover:text-red-600"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                              <path
                                  fillRule="evenodd"
                                  d="M3 10a1 1 0 011-1h8V6a1 1 0 011.707-.707l4 4a1 1 0 010 1.414l-4 4A1 1 0 0112 14v-3H4a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                              />
                            </svg>
                            Logout
                          </button>
                        </div>
                      </div>
                    </>
                )}
              </div>

            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-purple-200 bg-white/80 backdrop-blur-sm shadow-sm dark:border-purple-800 dark:bg-gray-800/80 dark:shadow-lg transition-all duration-200">
              <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      viewMode === "list"
                          ? "bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500 shadow-md"
                          : "text-teal-700 hover:bg-gradient-to-r hover:from-teal-400 hover:via-sky-400 hover:to-indigo-400 hover:text-white dark:text-teal-300 dark:hover:bg-gray-700/80"
                  }`}
              >
                List View
              </button>
              <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      viewMode === "calendar"
                          ? "bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500"
                          : "text-teal-700 hover:bg-gradient-to-r hover:from-teal-400 hover:via-sky-400 hover:to-indigo-400 hover:text-white dark:text-teal-300 dark:hover:bg-gray-700"
                  }`}
              >
                Calendar View
              </button>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
              {filteredAndSortedEvents.length}{" "}
              {filteredAndSortedEvents.length === 1 ? "event" : "events"}{" "}
              {viewMode === "calendar" ? `in ${currentMonthLabel}` : "listed"}
            </span>
          </div>
        </div>

        {/* Event Content */}
        {/* Render a dark-mode aware empty state when filters return nothing */}
        {filteredAndSortedEvents.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:border dark:border-gray-700 dark:shadow-[0_35px_70px_-40px_rgba(0,0,0,0.85)] transition-all duration-200">
              <h3 className="mt-2 text-xl font-medium text-gray-900 dark:text-gray-100">
                No events scheduled
              </h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">Check back later for upcoming events.</p>
            </div>
        ) : viewMode === "list" ? (
            <div className="events-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedEvents.map((event) => {
                const status = getEventStatus(event.start_time, event.end_time);
                const isSaved = myEvents.some((saved) => saved.event_id === event.event_id);
                return (
                    <div
                        key={event.event_id}
                        className={`event-card relative rounded-xl p-5 shadow-sm transition-all duration-300 transform
                            ${darkMode 
                              ? "bg-gradient-to-br from-blue-900/90 to-teal-900/90 border border-blue-800 shadow-xl" 
                              : "bg-white border border-gray-200"
                            }
                            ${hoveredEvent === event.event_id
                                ? darkMode 
                                    ? "shadow-xl scale-105 border-blue-500 ring-2 ring-blue-500/40 from-blue-800 to-teal-800"
                                    : "shadow-xl scale-105 border-blue-300 ring-2 ring-blue-100"
                                : darkMode
                                    ? "hover:shadow-lg hover:from-blue-800/90 hover:to-teal-800/90"
                                    : "hover:shadow-md hover:bg-gray-50"
                            }`}
                        onMouseEnter={() => setHoveredEvent(event.event_id)}
                        onMouseLeave={() => setHoveredEvent(null)}
                    >
                      {/* Status badge top-right */}
                      <span
                          className={`${status.color} absolute top-3 right-3 px-3 py-1 rounded-full font-medium text-sm`}
                      >
                  {status.label}
                </span>

                      <div>
                        <h3
                            className={`text-xl font-semibold mb-2 transition-colors duration-300 ${
                                darkMode
                                    ? hoveredEvent === event.event_id
                                        ? "text-sky-300"
                                        : "text-white"
                                    : hoveredEvent === event.event_id
                                        ? "text-blue-700"
                                        : "text-gray-900"
                            }`}
                            onClick={() => navigate(`/events/${event.event_id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                navigate(`/events/${event.event_id}`);
                              }
                            }}
                        >
                          {event.event_title}
                        </h3>
                        {event.description && (
                            <p className={`mb-4 line-clamp-3 transition-colors duration-200 ${
                                darkMode ? "text-gray-200" : "text-gray-600"
                            }`}>{event.description}</p>
                        )}

                        <div className="space-y-2 text-sm">
                          <div className="flex items-start">
                            <span className={`transition-colors duration-200 ${
                                darkMode ? "text-gray-100" : "text-gray-700"
                            }`}>
                              {formatDate(event.start_time)}
                              {event.end_time && ` - ${formatDate(event.end_time)}`}
                            </span>
                          </div>
                          {event.location && (
                              <div className="flex items-center gap-2 text-sm">
                                <svg className={`w-4 h-4 ${darkMode ? "text-sky-400" : "text--500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className={`transition-colors duration-200 ${
                                    darkMode ? "text-gray-100" : "text-gray-700"
                                }`}>{event.location}</span>
                              </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 group ${
                                interestedMap[event.event_id]
                                    ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-500 hover:shadow-lg dark:bg-emerald-500 dark:hover:bg-emerald-400"
                                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-md dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500 dark:hover:text-white"
                            }`}
                            onClick={() => toggleInterested(event)}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className={`w-5 h-5 transition-transform duration-200 ${interestedMap[event.event_id] ? 'scale-110' : 'group-hover:scale-110'}`} 
                                 viewBox="0 0 24 24" 
                                 fill={interestedMap[event.event_id] ? "currentColor" : "none"} 
                                 stroke="currentColor">
                              <path strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <span>{interestedMap[event.event_id] ? "Interested" : "Interest"}</span>
                          </span>
                        </button>
                        <button
                            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 group ${
                                isSaved
                                    ? "bg-blue-600 text-white shadow-md hover:bg-blue-500 hover:shadow-lg dark:bg-blue-500 dark:hover:bg-blue-400"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white hover:shadow-md dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500 dark:hover:text-white"
                            }`}
                            onClick={() => handleSave(event)}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className={`w-5 h-5 transition-transform duration-200 ${isSaved ? 'scale-110' : 'group-hover:scale-110'}`} 
                                 viewBox="0 0 24 24" 
                                 fill={isSaved ? "currentColor" : "none"} 
                                 stroke="currentColor">
                              <path strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span>{isSaved ? "Saved" : "Save"}</span>
                          </span>
                        </button>
                        <button
                            className="flex-1 py-3 px-4 rounded-xl font-medium bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white hover:from-teal-500 hover:via-sky-500 hover:to-indigo-500 dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500 shadow-md hover:shadow-lg transition-all duration-200 group"
                            onClick={() => navigate(`/events/${event.event_id}`)}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <span>View</span>
                          </span>
                        </button>
                      </div>
                    </div>
                );
              })}
            </div>
        ) : (
            <div className={`rounded-2xl border p-3 sm:p-6 shadow-lg transition-all duration-200 ${
                darkMode 
                  ? "border-blue-800 bg-gradient-to-br from-blue-900/90 to-teal-900/90 shadow-2xl" 
                  : "border-gray-200 bg-white"
              }`}>
              {/* Calendar Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    className={`rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 ${
                      darkMode
                        ? "text-gray-100 hover:bg-blue-800/50 border-2 border-blue-700 hover:border-blue-600"
                        : "text-gray-700 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
                  {currentMonthLabel}
                </h2>
                <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    className={`rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 ${
                      darkMode
                        ? "text-gray-100 hover:bg-sky-400/20 border-2 border-sky-700 hover:border-sky-600"
                        : "text-gray-700 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Weekday Labels */}
              <div className="grid grid-cols-7 mb-2 sm:mb-4">
                {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center">
                      <span className={`text-[10px] sm:text-xs font-bold tracking-wider px-1.5 sm:px-3 py-1 rounded-full inline-block transition-colors duration-200 ${
                        darkMode
                          ? "text-sky-300 bg-blue-900/60"
                          : "text-gray-500 bg-gray-100/80"
                      }`}>
                        {label.charAt(0)}
                        <span className="hidden sm:inline">{label.slice(1)}</span>
                      </span>
                    </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-3">
                {calendarMatrix.map((week, weekIndex) =>
                    week.map((day, dayIndex) => {
                      const isToday = new Date().toDateString() === day.date.toDateString();
                      return (
                          <div
                              key={`${weekIndex}-${dayIndex}`}
                              className={`group min-h-[80px] sm:min-h-[140px] rounded-lg sm:rounded-xl p-1.5 sm:p-3 text-left transition-all duration-200 ${
                                  darkMode
                                    ? day.isCurrentMonth
                                        ? "bg-gradient-to-br from-blue-900/70 to-teal-900/70 backdrop-blur-sm shadow-sm hover:shadow-md text-gray-100 hover:from-blue-800/70 hover:to-teal-800/70"
                                        : "bg-gradient-to-br from-blue-950/40 to-teal-950/40 text-gray-500"
                                    : day.isCurrentMonth
                                        ? "bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md"
                                        : "bg-gray-50/80 text-gray-400"
                              } ${
                                  isToday 
                                      ? `ring-1 sm:ring-2 shadow-lg ${darkMode ? "ring-sky-400/60" : "ring-blue-400"}` 
                                      : `border ${darkMode ? "border-blue-800/50" : "border-gray-100"}`
                              } ${
                                  day.events.length 
                                      ? "cursor-pointer hover:-translate-y-0.5 sm:hover:-translate-y-1 hover:shadow-lg" 
                                      : ""
                              }`}
                              role={day.events.length ? "button" : "presentation"}
                              tabIndex={day.events.length ? 0 : -1}
                              onClick={() => openDayEvents(day)}
                              onKeyDown={(event) => {
                                if (!day.events.length) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openDayEvents(day);
                                }
                              }}
                          >
                            <div className="mb-1 sm:mb-2 flex items-center justify-between">
                              <span className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full font-semibold text-xs sm:text-sm
                                ${isToday 
                                  ? "bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white shadow-md dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500" 
                                  : day.isCurrentMonth 
                                    ? "bg-white text-gray-700 group-hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:group-hover:bg-gray-700" 
                                    : "bg-gray-100 text-gray-400 dark:bg-gray-800/70 dark:text-gray-500"
                                }`}>
                                {day.date.getDate()}
                              </span>
                              {day.events.length > 0 && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 transition-colors duration-200">
                                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {day.events.length}
                                  </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 sm:gap-1.5">
                              {day.events.slice(0, 3).map((event) => (
                                  <button
                                      type="button"
                                      key={event.event_id}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        navigate(`/events/${event.event_id}`);
                                      }}
                                      onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
                                      className="flex flex-col gap-0.5 rounded-lg bg-gradient-to-r from-teal-50 via-sky-50 to-indigo-50 p-1 sm:p-2 text-left hover:from-teal-100 hover:via-sky-100 hover:to-indigo-100 dark:from-teal-900/40 dark:via-sky-900/40 dark:to-indigo-900/40 dark:hover:from-teal-800/60 dark:hover:via-sky-800/60 dark:hover:to-indigo-800/60 transition-all duration-200"
                                  >
                                    <span className={`font-semibold text-[10px] sm:text-xs truncate transition-colors duration-200 ${
                                      darkMode ? "text-sky-300" : "text-blue-800"
                                    }`}>
                                      {event.event_title}
                                    </span>
                                    <span className={`hidden sm:flex text-[10px] items-center gap-1 transition-colors duration-200 ${
                                      darkMode ? "text-sky-200" : "text-blue-600"
                                    }`}>
                                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {formatTimeRange(event.start_time, event.end_time)}
                                    </span>
                                    {event.location && (
                                        <span className="hidden sm:flex text-[10px] text-blue-500 dark:text-blue-300 items-center gap-1 truncate transition-colors duration-200">
                                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                          {event.location}
                                        </span>
                                    )}
                                  </button>
                              ))}
                              {day.events.length > 3 && (
                                  <span className="text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-50 rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 text-center dark:text-blue-200 dark:bg-blue-500/10 transition-colors duration-200">
                                    +{day.events.length - 3} more
                                  </span>
                              )}
                            </div>
                          </div>
                      );
                    })
                )}
              </div>
            </div>
        )}

        {/* Day Events Modal */}
        {isDayEventsOpen && selectedDayInfo && (
            <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-700 dark:text-gray-100 transition-all duration-200">
                <div className="mb-4 sm:mb-6 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                      Events on this day
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 sm:gap-2 transition-colors duration-200">
                      <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDayHeading(selectedDayInfo.date)}
                    </p>
                  </div>
                  <button
                      type="button"
                      onClick={() => {
                        setIsDayEventsOpen(false);
                        setSelectedDayInfo(null);
                      }}
                      className="rounded-xl bg-gray-100 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-1 sm:gap-2"
                  >
                    <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close
                  </button>
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {selectedDayInfo.events.map((event) => (
                      <div
                          key={event.event_id}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md dark:shadow-lg dark:hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-200">{event.event_title}</h3>
                            <p className="text-sm text-blue-600 dark:text-blue-300 transition-colors duration-200">
                              {formatTimeRange(event.start_time, event.end_time)}
                            </p>
                            {event.location && (
                                <p className="text-sm text-gray-500 dark:text-gray-300 transition-colors duration-200">{event.location}</p>
                            )}
                          </div>
                          <button
                              type="button"
                              onClick={() => {
                                setIsDayEventsOpen(false);
                                setSelectedDayInfo(null);
                                navigate(`/events/${event.event_id}`);
                              }}
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                          >
                            View
                          </button>
                        </div>
                        {event.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3 transition-colors duration-200">{event.description}</p>
                        )}
                      </div>
                  ))}
                </div>
              </div>
            </div>
        )}

        {/* My Events Modal */}
        {isMyEventsOpen && (
            <div className="fixed inset-0 flex justify-center items-start pt-20 z-50 backdrop-blur-sm bg-white/20 dark:bg-black/75 transition-all duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative text-gray-900 dark:text-gray-100 transition-all duration-200">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100 text-center">My Events</h2>
                <button
                    className="absolute top-2 right-2 text-gray-800 hover:text-black dark:text-gray-300 dark:hover:text-white font-bold text-xl transition-colors duration-200"
                    onClick={() => setIsMyEventsOpen(false)}
                >
                  X
                </button>
                {myEvents.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-300 mt-6 transition-colors duration-200">No saved events yet.</p>
                ) : (
                    <ul className="space-y-4 max-h-80 overflow-y-auto">
                      {myEvents.map((event) => (
                          <li
                              key={event.event_id}
                              className="flex justify-between items-center p-3 bg-white/80 dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md dark:shadow-lg dark:hover:shadow-xl transition-all duration-200"
                          >
                            <div>
                              <h3 className="font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-200">{event.event_title}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 transition-colors duration-200">
                                {new Date(event.start_time).toLocaleString()}
                              </p>
                            </div>
                            <button
                                className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 dark:hover:bg-red-500 transition-colors duration-200"
                                onClick={() => {
                                  const updated = myEvents.filter((e) => e.event_id !== event.event_id);
                                  setMyEvents(updated);
                                  localStorage.setItem("myEvents", JSON.stringify(updated));
                                }}
                            >
                              Remove
                            </button>
                          </li>
                      ))}
                    </ul>
                )}
              </div>
            </div>
        )}

        {/* Edit Interests Modal */}
        {isEditInterestsOpen && (
            <InterestsDialog
                open={isEditInterestsOpen}
                onClose={() => setIsEditInterestsOpen(false)}
                onSaved={() => setIsEditInterestsOpen(false)}
            />
        )}

        </div>
      </div>
  );
};

export default EventsScreen;

