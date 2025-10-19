import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import InterestsDialog from "../components/InterestsDialog.jsx";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EventsScreen = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [interestedMap, setInterestedMap] = useState({});
  const [myEvents, setMyEvents] = useState(() => {
    const saved = localStorage.getItem("myEvents");
    return saved ? JSON.parse(saved) : [];
  });
  const [isMyEventsOpen, setIsMyEventsOpen] = useState(false);
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [isEditInterestsOpen, setIsEditInterestsOpen] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [isDayEventsOpen, setIsDayEventsOpen] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  const navigate = useNavigate();
  const API_BASE_URL = useMemo(
      () => import.meta.env.VITE_API_URL || "http://localhost:3000",
      []
  );

  // ≡ƒƒó Helper function for status
  const getEventStatus = (start, end) => {
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (now >= startDate && now <= endDate) {
      return { label: "On Going", color: "bg-green-100 text-green-700" };
    } else if (now < startDate) {
      return { label: "Up Coming", color: "bg-yellow-100 text-yellow-700" };
    } else {
      return { label: "Ended", color: "bg-red-100 text-red-700" };
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
    start.setDate(monthStart.getDate() - monthStart.getDay());

    const weeks = [];
    for (let week = 0; week < 6; week += 1) {
      const days = [];
      for (let day = 0; day < 7; day += 1) {
        const cellDate = new Date(start);
        cellDate.setDate(start.getDate() + week * 7 + day);
        const isoKey = cellDate.toISOString().split("T")[0];
        days.push({
          date: cellDate,
          isCurrentMonth: cellDate.getMonth() === month,
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
  );

  useEffect(() => {
    const seen = localStorage.getItem("seenEditInterestsPrompt");
    if (!seen) {
      setIsEditInterestsOpen(true);
      localStorage.setItem("seenEditInterestsPrompt", "1");
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data || []);

      // Load interested status
      if (Array.isArray(data) && data.length) {
        const pairs = await Promise.all(
            data.map(async (e) => {
              try {
                const r = await fetch(`${API_BASE_URL}/api/interested/status/${e.event_id}`, {
                  credentials: "include",
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

  const toggleInterested = async (event) => {
    const id = event.event_id;
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

    try {
      const method = next ? "POST" : "DELETE";
      const r = await fetch(`${API_BASE_URL}/api/interested`, {
        method,
        headers: { "Content-Type": "application/json" },
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

  const handleSave = (event) => {
    if (!myEvents.find((e) => e.event_id === event.event_id)) {
      const updated = [...myEvents, event];
      updated.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      setMyEvents(updated);
      localStorage.setItem("myEvents", JSON.stringify(updated));
      setShowSavePopup(true);
      setTimeout(() => setShowSavePopup(false), 1500);
    }
  };

  const formatDate = (dateString) =>
      new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

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

  const handleMonthChange = (offset) => {
    setCalendarDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      return next;
    });
  };

  const formatDayHeading = (date) =>
      date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

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
        <div className="events-screen p-6">
          <h2 className="text-2xl font-bold mb-4">Events</h2>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
    );

  if (error)
    return (
        <div className="events-screen p-6">
          <h2 className="text-2xl font-bold mb-4">Events</h2>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
    );

  return (
      <div className="events-screen p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <h2 className="text-3xl font-bold text-gray-800 md:mr-2 whitespace-nowrap">
              Events
            </h2>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title, description, or location..."
                className="w-full md:flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-3 md:ml-auto">
              <button
                  onClick={() => navigate("/recommended")}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Recommended Events
              </button>
              <button
                  onClick={() => setIsEditInterestsOpen(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Edit Interests
              </button>
              <button
                  onClick={() => setIsMyEventsOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                My Events
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
              <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === "list"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                List View
              </button>
              <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === "calendar"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                Calendar View
              </button>
            </div>
            <span className="text-sm text-gray-500">
              {filteredAndSortedEvents.length}{" "}
              {filteredAndSortedEvents.length === 1 ? "event" : "events"}{" "}
              {viewMode === "calendar" ? `in ${currentMonthLabel}` : "listed"}
            </span>
          </div>
        </div>

        {/* Event Content */}
        {filteredAndSortedEvents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <h3 className="mt-2 text-xl font-medium text-gray-900">
                No events scheduled
              </h3>
              <p className="mt-1 text-gray-500">Check back later for upcoming events.</p>
            </div>
        ) : viewMode === "list" ? (
            <div className="events-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedEvents.map((event) => {
                const status = getEventStatus(event.start_time, event.end_time);
                return (
                    <div
                        key={event.event_id}
                        className={`event-card relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all duration-300 transform ${
                            hoveredEvent === event.event_id
                                ? "shadow-xl scale-105 border-blue-300 ring-2 ring-blue-100"
                                : "hover:shadow-md"
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
                                hoveredEvent === event.event_id
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
                            <p className="text-gray-600 mb-4 line-clamp-3">{event.description}</p>
                        )}

                        <div className="space-y-2 text-sm">
                          <div className="flex items-start">
                      <span className="text-gray-700">
                        {formatDate(event.start_time)}
                        {event.end_time && ` - ${formatDate(event.end_time)}`}
                      </span>
                          </div>
                          {event.location && (
                              <div className="flex items-start">
                                <span className="text-gray-700">{event.location}</span>
                              </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                            className={`flex-1 py-2 px-4 rounded-lg font-medium border transition-colors ${
                                interestedMap[event.event_id]
                                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                    : "text-blue-600 border-blue-600 bg-transparent hover:bg-blue-600 hover:text-white"
                            }`}
                            onClick={() => toggleInterested(event)}
                        >
                    <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                      <span>Interested</span>
                      {interestedMap[event.event_id] && (
                          <span aria-hidden="true">{"\u2713"}</span>
                      )}
                    </span>
                        </button>
                        <button
                            className="flex-1 py-2 px-4 rounded-lg font-medium text-red-600 border border-red-600 bg-transparent hover:bg-red-600 hover:text-white transition-colors"
                            onClick={() => handleSave(event)}
                        >
                          Save
                        </button>
                        <button
                            className="flex-1 py-2 px-4 rounded-lg font-medium text-black border border-black bg-transparent hover:bg-black hover:text-white transition-colors"
                            onClick={() => navigate(`/events/${event.event_id}`)}
                        >
                          More
                        </button>
                      </div>
                    </div>
                );
              })}
            </div>
        ) : (
            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-3 sm:p-6 shadow-lg">
              {/* Calendar Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    className="rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center gap-1 sm:gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {currentMonthLabel}
                </h2>
                <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    className="rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center gap-1 sm:gap-2"
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
                      <span className="text-[10px] sm:text-xs font-bold tracking-wider text-gray-500 bg-gray-100/80 px-1.5 sm:px-3 py-1 rounded-full inline-block">
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
                                  day.isCurrentMonth
                                      ? "bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md"
                                      : "bg-gray-50/80 text-gray-400"
                              } ${
                                  isToday 
                                      ? "ring-1 sm:ring-2 ring-blue-400 shadow-lg" 
                                      : "border border-gray-100"
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
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" 
                                  : day.isCurrentMonth 
                                    ? "bg-white text-gray-700 group-hover:bg-gray-100" 
                                    : "bg-gray-100 text-gray-400"
                                }`}>
                                {day.date.getDate()}
                              </span>
                              {day.events.length > 0 && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-blue-700">
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
                                      className="flex flex-col gap-0.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-1 sm:p-2 text-left hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                                  >
                                    <span className="font-semibold text-[10px] sm:text-xs text-blue-800 truncate">
                                      {event.event_title}
                                    </span>
                                    <span className="hidden sm:flex text-[10px] text-blue-600 items-center gap-1">
                                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {formatTimeRange(event.start_time, event.end_time)}
                                    </span>
                                    {event.location && (
                                        <span className="hidden sm:flex text-[10px] text-blue-500 items-center gap-1 truncate">
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
                                  <span className="text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-50 rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
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
              <div className="w-full max-w-lg rounded-2xl bg-white/90 p-4 sm:p-8 shadow-2xl border border-gray-100">
                <div className="mb-4 sm:mb-6 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                      Events on this day
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1 sm:gap-2">
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
                      className="rounded-xl bg-gray-100 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors duration-200 flex items-center gap-1 sm:gap-2"
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
                          className="rounded-lg border border-gray-200 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{event.event_title}</h3>
                            <p className="text-sm text-blue-600">
                              {formatTimeRange(event.start_time, event.end_time)}
                            </p>
                            {event.location && (
                                <p className="text-sm text-gray-500">{event.location}</p>
                            )}
                          </div>
                          <button
                              type="button"
                              onClick={() => {
                                setIsDayEventsOpen(false);
                                setSelectedDayInfo(null);
                                navigate(`/events/${event.event_id}`);
                              }}
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            View
                          </button>
                        </div>
                        {event.description && (
                            <p className="mt-2 text-sm text-gray-600 line-clamp-3">{event.description}</p>
                        )}
                      </div>
                  ))}
                </div>
              </div>
            </div>
        )}

        {/* My Events Modal */}
        {isMyEventsOpen && (
            <div className="fixed inset-0 flex justify-center items-start pt-20 z-50 backdrop-blur-sm bg-white/20">
              <div className="bg-gradient-to-b from-white to-blue-200 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">My Events</h2>
                <button
                    className="absolute top-2 right-2 text-gray-800 hover:text-black font-bold text-xl"
                    onClick={() => setIsMyEventsOpen(false)}
                >
                  Γ£ò
                </button>
                {myEvents.length === 0 ? (
                    <p className="text-center text-gray-600 mt-6">No saved events yet.</p>
                ) : (
                    <ul className="space-y-4 max-h-80 overflow-y-auto">
                      {myEvents.map((event) => (
                          <li
                              key={event.event_id}
                              className="flex justify-between items-center p-3 bg-white/70 rounded-lg shadow-sm hover:shadow-md transition-all"
                          >
                            <div>
                              <h3 className="font-semibold text-gray-800">{event.event_title}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(event.start_time).toLocaleString()}
                              </p>
                            </div>
                            <button
                                className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
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

        {/* Save Success Popup */}
        <AnimatePresence>
          {showSavePopup && (
              <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.4 }}
                  className="fixed inset-0 flex justify-center items-center z-[9999]"
              >
                <div className="bg-green-500 text-white p-6 rounded-full shadow-2xl flex items-center justify-center">
                  <span className="text-4xl font-bold">Γ£ö</span>
                </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};

export default EventsScreen;
