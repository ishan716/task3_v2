import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";

function computeStatus(event) {
  const now = Date.now();
  const start = event?.start_time ? Date.parse(event.start_time) : null;
  const end = event?.end_time ? Date.parse(event.end_time) : null;
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

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

export default function AdminAnalytics() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const response = await apiGet("/api/admin/events");
        setEvents(response.items || []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const totalEvents = useMemo(() => events.length, [events]);

  const totalInterested = useMemo(
    () =>
      events.reduce((sum, event) => {
        const count = Number(event?.interested_count ?? 0);
        return Number.isFinite(count) ? sum + count : sum;
      }, 0),
    [events]
  );

  const statusBreakdown = useMemo(() => {
    const base = {
      Upcoming: 0,
      Ongoing: 0,
      Past: 0,
      Unknown: 0,
    };
    events.forEach((event) => {
      const status = computeStatus(event);
      base[status] = (base[status] || 0) + 1;
    });
    return base;
  }, [events]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      (event?.categories || []).forEach((category) => {
        const label = category?.category_name || "Uncategorized";
        map.set(label, (map.get(label) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const topEventsByInterest = useMemo(() => {
    return [...events]
      .sort(
        (a, b) => (Number(b?.interested_count) || 0) - (Number(a?.interested_count) || 0)
      )
      .slice(0, 5);
  }, [events]);

  const averageInterest = totalEvents ? totalInterested / totalEvents : 0;

  return (
    <div className="min-h-screen bg-gray-100 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Analytics Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor engagement and event performance at a glance.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Back to Dashboard
          </Link>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Key Metrics
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Snapshot of the latest event statistics.
            </p>
          </div>
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total Events
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : totalEvents.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total Interested Users
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : totalInterested.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Average Interest / Event
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : averageInterest.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Upcoming Events
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : statusBreakdown.Upcoming.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Event Status Breakdown
            </h2>
          </div>
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Upcoming", statusBreakdown.Upcoming],
              ["Ongoing", statusBreakdown.Ongoing],
              ["Past", statusBreakdown.Past],
              ["Unknown", statusBreakdown.Unknown],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {label}
                </p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {loading ? "--" : value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Categories Engagement
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Distribution of events across interest categories.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                    Event Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : categoryBreakdown.length ? (
                  categoryBreakdown.map(([category, count]) => (
                    <tr key={category}>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {category}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        {count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No category data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Top Events by Interest
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Highest engagement events based on interested users.
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
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                    Interested Users
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : topEventsByInterest.length ? (
                  topEventsByInterest.map((event) => (
                    <tr key={event.event_id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.event_title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        <div>{formatDateTime(event.start_time)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          to {formatDateTime(event.end_time)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {computeStatus(event)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {(Number(event?.interested_count) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No interest data yet.
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
