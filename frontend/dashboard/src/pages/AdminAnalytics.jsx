import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API, apiGet } from "../api";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function formatMonthLabel(input) {
  if (!input || typeof input !== "string") return input || "--";
  const [year, month] = input.split("-").map(Number);
  if (!year || !month) return input;
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function barWidth(value, max) {
  if (!max || max <= 0) return "0%";
  const percentage = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return `${percentage}%`;
}

function formatDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getDefaultFilters() {
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)
  );
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 5);
  start.setUTCDate(1);

  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
    categories: [],
  };
}

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formFilters, setFormFilters] = useState(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState(() => getDefaultFilters());
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(
    async (filtersToApply) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filtersToApply?.start) params.set("start", filtersToApply.start);
        if (filtersToApply?.end) params.set("end", filtersToApply.end);
        if (filtersToApply?.categories?.length) {
          params.set("categories", filtersToApply.categories.join(","));
        }

        const path = params.toString()
          ? `/api/admin/analytics?${params.toString()}`
          : "/api/admin/analytics";

        const response = await apiGet(path);
        setAnalytics(response || null);

        const normalizedFilters = {
          start: response?.filters?.start
            ? response.filters.start.slice(0, 10)
            : filtersToApply?.start || "",
          end: response?.filters?.end
            ? response.filters.end.slice(0, 10)
            : filtersToApply?.end || "",
          categories: Array.isArray(response?.filters?.categories)
            ? response.filters.categories.map((id) => String(id))
            : (filtersToApply?.categories || []).map((id) => String(id)),
        };

        setAppliedFilters(normalizedFilters);
        setFormFilters((prev) => ({ ...prev, ...normalizedFilters }));
      } catch (err) {
        console.error(err);
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const data = await apiGet("/api/interests/categories");
        if (!cancelled) {
          const items = Array.isArray(data) ? [...data] : [];
          items.sort((a, b) => {
            const aName = a?.category_name || "";
            const bName = b?.category_name || "";
            return aName.localeCompare(bName);
          });
          setCategoryOptions(items);
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchAnalytics(getDefaultFilters());
  }, [fetchAnalytics]);

  const handleStartDateChange = (event) => {
    const value = event.target.value;
    setFormFilters((prev) => ({ ...prev, start: value }));
  };

  const handleEndDateChange = (event) => {
    const value = event.target.value;
    setFormFilters((prev) => ({ ...prev, end: value }));
  };

  const handleCategoryChange = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setFormFilters((prev) => ({ ...prev, categories: selected }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    if (formFilters.start && formFilters.end) {
      const startDate = new Date(formFilters.start);
      const endDate = new Date(formFilters.end);
      if (startDate > endDate) {
        setError("Start date must be before end date.");
        return;
      }
    }
    fetchAnalytics(formFilters);
  };

  const handleResetFilters = () => {
    const defaults = getDefaultFilters();
    setFormFilters(defaults);
    fetchAnalytics(defaults);
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (appliedFilters.start) params.set("start", appliedFilters.start);
      if (appliedFilters.end) params.set("end", appliedFilters.end);
      if (appliedFilters.categories.length) {
        params.set("categories", appliedFilters.categories.join(","));
      }
      params.set("format", "csv");

      // include authorization header (if available) so admin-protected
      // endpoints accept the request on branches that require Bearer tokens
      const token = localStorage.getItem("accessToken");
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API}/api/admin/analytics?${params.toString()}`, {
        credentials: "include",
        headers: {
          ...authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
    const startLabel = appliedFilters.start || "all";
    const endLabel = appliedFilters.end || "latest";
    // === ADMIN_ANALYTICS_PATCH_START: filename sanitization adjustment ===
    // Previously used an unnecessary escaped dot in the regex which triggered
    // an eslint no-useless-escape warning. The regex now allows a literal dot
    // and underscores/hyphens and replaces other characters with '-'.
    const filename = `analytics-${startLabel}_${endLabel}.csv`.replace(/[^a-z0-9-_.]/gi, "-");
    // === ADMIN_ANALYTICS_PATCH_END ===
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to export analytics data.");
    } finally {
      setExporting(false);
    }
  };

  const filtersChanged = useMemo(() => {
    if (formFilters.start !== appliedFilters.start) return true;
    if (formFilters.end !== appliedFilters.end) return true;
    const current = [...formFilters.categories].sort().join(",");
    const applied = [...appliedFilters.categories].sort().join(",");
    return current !== applied;
  }, [formFilters, appliedFilters]);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    categoryOptions.forEach((category) => {
      map.set(String(category.category_id), category.category_name);
    });
    return map;
  }, [categoryOptions]);

  const appliedCategoryNames = useMemo(() => {
    if (!appliedFilters.categories.length) return [];
    return appliedFilters.categories.map((id) => categoryNameById.get(id) || id);
  }, [appliedFilters.categories, categoryNameById]);

  const appliedCategorySummary = useMemo(() => {
    if (!appliedCategoryNames.length) return "All";
    if (appliedCategoryNames.length <= 3) {
      return appliedCategoryNames.join(", ");
    }
    const [first, second, third] = appliedCategoryNames;
    return `${first}, ${second}, ${third} (+${appliedCategoryNames.length - 3} more)`;
  }, [appliedCategoryNames]);

  const summary = analytics?.summary || {
    totalEvents: 0,
    totalInterested: 0,
    averageInterest: 0,
  };

  const statusBreakdown = analytics?.statusBreakdown || {
    Upcoming: 0,
    Ongoing: 0,
    Past: 0,
    Unknown: 0,
  };

  const categories = analytics?.categories || [];
  const topEvents = analytics?.topEvents || [];
  // === ADMIN_ANALYTICS_PATCH_START: memoize timeline to stabilize reference ===
  // Wrap timeline in useMemo so dependent hooks compute only when `analytics`
  // changes. This fixes eslint warnings about unstable dependencies.
  const timeline = useMemo(() => analytics?.timeline ?? [], [analytics]);
  // === ADMIN_ANALYTICS_PATCH_END ===

  const maxInterested = useMemo(
    () => timeline.reduce((max, item) => Math.max(max, item.interestedCount || 0), 0),
    [timeline]
  );

  const maxEvents = useMemo(
    () => timeline.reduce((max, item) => Math.max(max, item.eventCount || 0), 0),
    [timeline]
  );

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
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggleButton />
            <Link
              to="/admin"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <form className="space-y-4 px-6 py-6" onSubmit={handleApplyFilters}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formFilters.start}
                  onChange={handleStartDateChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  End Date
                </label>
                <input
                  type="date"
                  value={formFilters.end}
                  onChange={handleEndDateChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Categories
                </label>
                {categoryOptions.length ? (
                  <select
                    multiple
                    size={Math.min(8, Math.max(3, categoryOptions.length || 3))}
                    value={formFilters.categories}
                    onChange={handleCategoryChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category.category_id} value={String(category.category_id)}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No categories available yet.
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Hold Ctrl (Windows) or Cmd (macOS) to select multiple categories.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading..." : "Apply Filters"}
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading || !filtersChanged}
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting || loading || !analytics}
                className="inline-flex items-center rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400/70 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
              >
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span>
                Applied range: {appliedFilters.start || "earliest"} → {appliedFilters.end || "latest"}.
              </span>
              <span className="ml-2">
                Categories: {appliedCategorySummary}
              </span>
            </div>
          </form>
        </section>

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
                {loading ? "--" : summary.totalEvents.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total Interested Users
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : summary.totalInterested.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Average Interest / Event
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? "--" : summary.averageInterest.toFixed(1)}
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
            {["Upcoming", "Ongoing", "Past", "Unknown"].map((label) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {label}
                </p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {loading ? "--" : statusBreakdown[label].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Interest Trend (Last 6 Months)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing events created and total interested users per month.
            </p>
            {/* Legend for the two inline bars: blue = events, green = interested users */}
            <div className="mt-3 px-6">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    title="Events per month: number of events whose start date is in this month"
                    className="inline-block h-3 w-6 rounded bg-blue-500"
                  />
                  <span className="text-xs">Events (per month)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    title="Interested users per month: sum of interested_count for events starting that month"
                    className="inline-block h-3 w-6 rounded bg-emerald-500"
                  />
                  <span className="text-xs">Interested users (sum)</span>
                </div>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  The blue bar shows how many events started that month. The green bar shows total interested users across those events.
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Month
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                    Events
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                    Interested Users
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    Trend
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
                ) : timeline.length ? (
                  timeline.map((entry) => (
                    <tr key={entry.month}>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {formatMonthLabel(entry.month)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        {entry.eventCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        {entry.interestedCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <div
                              className="h-2 rounded-full bg-blue-500 dark:bg-blue-400"
                              style={{ width: barWidth(entry.eventCount, maxEvents) }}
                            />
                          </div>
                          <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                            <div
                              className="h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                              style={{ width: barWidth(entry.interestedCount, maxInterested) }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No data for this range yet.
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
                ) : categories.length ? (
                  categories.map(({ category, count }) => (
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
                ) : topEvents.length ? (
                  topEvents.map((event) => (
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
                        {event.status}
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
