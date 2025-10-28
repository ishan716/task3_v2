import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiJSON, apiDelete } from "../api";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";

const initialForm = {
  event_title: "",
  description: "",
  location: "",
  start_time: "",
  end_time: "",
};

function isoToLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function localToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function computeStatus(event) {
  const now = Date.now();
  const start = event.start_time ? Date.parse(event.start_time) : null;
  const end = event.end_time ? Date.parse(event.end_time) : null;
  if (start && end) {
    if (now >= start && now <= end) return "Ongoing";
    if (now < start) return "Upcoming";
    return "Past";
  }
  if (start) {
    return now < start ? "Upcoming" : "Past";
  }
  return "Unknown";
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadEvents() {
    setLoadingEvents(true);
    try {
      const response = await apiGet("/api/admin/events");
      setEvents(response.items || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load events.");
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await apiGet("/api/interests/categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadEvents();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(initialForm);
    setSelectedCategories([]);
    setEditingId(null);
    setFormError(null);
  }

  function handleEdit(event) {
    setEditingId(event.event_id);
    setForm({
      event_title: event.event_title || "",
      description: event.description || "",
      location: event.location || "",
      start_time: isoToLocalInput(event.start_time),
      end_time: isoToLocalInput(event.end_time),
    });
    const catIds = (event.categories || []).map((c) => String(c.category_id));
    setSelectedCategories(catIds);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCategory(id) {
    setSelectedCategories((prev) => {
      const strId = String(id);
      if (prev.includes(strId)) {
        return prev.filter((value) => value !== strId);
      }
      return [...prev, strId];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const categoriesPayload = selectedCategories
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0);

    const payload = {
      event_title: form.event_title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_time: localToIso(form.start_time),
      end_time: localToIso(form.end_time),
      categories: categoriesPayload,
    };

    if (!payload.event_title || !payload.start_time || !payload.end_time) {
      setFormError("Event title, start time, and end time are required.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await apiJSON("PUT", `/api/admin/events/${editingId}`, payload);
      } else {
        await apiJSON("POST", "/api/admin/events", payload);
      }
      await loadEvents();
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId) {
    const id = Number(eventId);
    if (!Number.isFinite(id)) return;
    const event = events.find((item) => item.event_id === id);
    const label = event?.event_title ? `"${event.event_title}"` : "this event";

    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await apiDelete(`/api/admin/events/${id}`);
      await loadEvents();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
      setError("Failed to delete event.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalEvents = useMemo(() => events.length, [events]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-10">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage events and categories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => navigate("/admin/analytics")}
              className="inline-flex items-center rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
            >
              View Analytics
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                loadEvents();
                loadCategories();
              }}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("accessToken");
                navigate("/admin/login");
              }}
              className="inline-flex items-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:bg-gray-900 dark:text-red-200 dark:hover:border-red-600 dark:hover:bg-red-900/20"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {editingId ? "Edit Event" : "Create Event"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Fill out the details below to {editingId ? "update" : "create"} an
              event.
            </p>
          </div>
          <form className="px-6 py-6 space-y-4" onSubmit={handleSubmit}>
            {formError && (
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-200">
                {formError}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label
                  htmlFor="admin-event-title"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Event Title
                </label>
                <input
                  id="admin-event-title"
                  type="text"
                  value={form.event_title}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      event_title: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Event title"
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <label
                  htmlFor="admin-event-description"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Description
                </label>
                <textarea
                  id="admin-event-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Describe the event"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-event-location"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Location
                </label>
                <input
                  id="admin-event-location"
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="e.g., Main Hall"
                />
              </div>
              <div />
              <div>
                <label
                  htmlFor="admin-event-start"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Start Time
                </label>
                <input
                  id="admin-event-start"
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      start_time: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="admin-event-end"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  End Time
                </label>
                <input
                  id="admin-event-end"
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      end_time: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Categories
              </span>
              {categories.length ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const id = String(category.category_id);
                    const checked = selectedCategories.includes(id);
                    return (
                      <label
                        key={category.category_id}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm transition ${
                          checked
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/70 dark:bg-blue-900/40 dark:text-blue-200"
                            : "border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
                        />
                        {category.category_name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No categories available. Create categories first.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? editingId
                    ? "Saving changes..."
                    : "Creating..."
                  : editingId
                  ? "Save Changes"
                  : "Create Event"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Events
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loadingEvents
                ? "Loading events..."
                : `${totalEvents} event${totalEvents === 1 ? "" : "s"} found`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Categories
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Interested
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {loadingEvents ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading events...
                    </td>
                  </tr>
                ) : events.length ? (
                  events.map((event) => (
                    <tr key={event.event_id} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {event.event_title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {event.location || "No location"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        <div>{formatDateTime(event.start_time)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          to {formatDateTime(event.end_time)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(event.categories || []).length ? (
                            event.categories.map((cat) => (
                              <span
                                key={cat.category_id}
                                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                              >
                                {cat.category_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              --
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {event.interested_count ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                          {computeStatus(event)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(event.event_id)}
                            disabled={deletingId === event.event_id}
                            className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-900/40"
                          >
                            {deletingId === event.event_id ? "Removing..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
