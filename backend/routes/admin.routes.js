const express = require("express");
const supabase = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

function computeEventStatus(event) {
    const now = Date.now();
    const start = event?.start_time ? Date.parse(event.start_time) : NaN;
    const end = event?.end_time ? Date.parse(event.end_time) : NaN;

    if (Number.isFinite(start) && Number.isFinite(end)) {
        if (now >= start && now <= end) return "Ongoing";
        if (now < start) return "Upcoming";
        return "Past";
    }

    if (Number.isFinite(start)) {
        return now < start ? "Upcoming" : "Past";
    }

    return "Unknown";
}

function mapEventRow(row) {
    const categories =
        Array.isArray(row.event_categories) && row.event_categories.length > 0
            ? row.event_categories
                  .filter((ec) => ec && ec.category)
                  .map((ec) => ({
                      category_id: ec.category.category_id,
                      category_name: ec.category.category_name,
                  }))
            : [];

    return {
        event_id: row.event_id,
        event_title: row.event_title,
        description: row.description,
        location: row.location,
        start_time: row.start_time,
        end_time: row.end_time,
        interested_count: Number(row.interested_count) || 0,
        categories,
    };
}

function getRecentMonthKeys(count = 6) {
    const months = [];
    const now = new Date();
    const anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const date = new Date(anchor);
        date.setUTCMonth(date.getUTCMonth() - offset);
        const key = `${date.getUTCFullYear()}-${String(
            date.getUTCMonth() + 1
        ).padStart(2, "0")}`;
        months.push(key);
    }
    return months;
}

function getMonthsBetween(startDate, endDate, maxMonths = 60) {
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return [];
    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return [];

    const startAnchor = new Date(
        Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
    );
    const endAnchor = new Date(
        Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1)
    );

    if (startAnchor > endAnchor) {
        return getMonthsBetween(endDate, startDate, maxMonths);
    }

    const months = [];
    const cursor = new Date(startAnchor);
    let iterations = 0;
    while (cursor <= endAnchor && iterations < maxMonths) {
        months.push(
            `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(
                2,
                "0"
            )}`
        );
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        iterations += 1;
    }
    return months;
}

function resolveTimelineMonths(events, { startDate, endDate } = {}) {
    if (startDate && endDate) {
        const months = getMonthsBetween(startDate, endDate);
        if (months.length) return months;
    }

    const eventDates = events
        .map((event) => (event?.start_time ? Date.parse(event.start_time) : NaN))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

    if (eventDates.length) {
        const first = new Date(eventDates[0]);
        const last = new Date(eventDates[eventDates.length - 1]);
        const months = getMonthsBetween(first, last);
        if (months.length) return months;
    }

    return getRecentMonthKeys(6);
}

function buildAnalytics(events, options = {}) {
    const { startDate = null, endDate = null } = options;
    const totalEvents = events.length;
    const totalInterested = events.reduce(
        (sum, event) => sum + (Number(event.interested_count) || 0),
        0
    );

    const statusBreakdown = {
        Upcoming: 0,
        Ongoing: 0,
        Past: 0,
        Unknown: 0,
    };

    const categoryCounts = new Map();

    events.forEach((event) => {
        const status = computeEventStatus(event);
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

        (event.categories || []).forEach((category) => {
            const label = category?.category_name || "Uncategorized";
            categoryCounts.set(label, (categoryCounts.get(label) || 0) + 1);
        });
    });

    const categoryBreakdown = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

    const topEvents = [...events]
        .sort(
            (a, b) =>
                (Number(b?.interested_count) || 0) -
                (Number(a?.interested_count) || 0)
        )
        .slice(0, 5)
        .map((event) => ({
            event_id: event.event_id,
            event_title: event.event_title,
            start_time: event.start_time,
            end_time: event.end_time,
            interested_count: Number(event.interested_count) || 0,
            status: computeEventStatus(event),
        }));

    const months = resolveTimelineMonths(events, { startDate, endDate });
    const timelineMap = new Map(
        months.map((month) => [month, { eventCount: 0, interestedCount: 0 }])
    );

    events.forEach((event) => {
        const parsed = event?.start_time ? Date.parse(event.start_time) : NaN;
        if (!Number.isFinite(parsed)) return;
        const date = new Date(parsed);
        const key = `${date.getUTCFullYear()}-${String(
            date.getUTCMonth() + 1
        ).padStart(2, "0")}`;
        if (!timelineMap.has(key)) return;
        const bucket = timelineMap.get(key);
        bucket.eventCount += 1;
        bucket.interestedCount += Number(event.interested_count) || 0;
    });

    const timeline = months.map((month) => ({
        month,
        eventCount: timelineMap.get(month)?.eventCount || 0,
        interestedCount: timelineMap.get(month)?.interestedCount || 0,
    }));

    return {
        summary: {
            totalEvents,
            totalInterested,
            averageInterest: totalEvents
                ? Number((totalInterested / totalEvents).toFixed(2))
                : 0,
        },
        statusBreakdown,
        categories: categoryBreakdown,
        topEvents,
        timeline,
    };
}

function parseDateAtUtcStart(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
    );
}

function parseDateAtUtcEnd(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            23,
            59,
            59,
            999
        )
    );
}

function parseDateFilters(query) {
    const startDate = parseDateAtUtcStart(query?.start);
    const endDate = parseDateAtUtcEnd(query?.end);

    if (startDate && endDate && startDate > endDate) {
        return { startDate: endDate, endDate: startDate };
    }

    return { startDate, endDate };
}

function parseCategoryFilter(param) {
    if (!param) return [];
    const values = Array.isArray(param)
        ? param
        : String(param)
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0);
    const sanitized = sanitizeCategoryIds(values);
    return sanitized
        .map((value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        })
        .filter((value) => value !== null);
}

function analyticsToCsv(analytics, filters = {}) {
    const lines = [];

    const csvValue = (value) => {
        if (value === null || value === undefined) return "";
        const str = String(value).replace(/"/g, '""');
        return /[",\n\r]/.test(str) ? `"${str}"` : str;
    };

    lines.push("Filters");
    lines.push("Key,Value");
    lines.push(`Start,${csvValue(filters.start || "")}`);
    lines.push(`End,${csvValue(filters.end || "")}`);
    lines.push(`Categories,${csvValue((filters.categories || []).join("; "))}`);
    lines.push("");

    lines.push("Summary");
    lines.push("Metric,Value");
    lines.push(`Total Events,${csvValue(analytics.summary.totalEvents)}`);
    lines.push(`Total Interested,${csvValue(analytics.summary.totalInterested)}`);
    lines.push(`Average Interest Per Event,${csvValue(analytics.summary.averageInterest)}`);
    lines.push("");

    lines.push("Status Breakdown");
    lines.push("Status,Count");
    Object.entries(analytics.statusBreakdown || {}).forEach(([status, count]) => {
        lines.push(`${csvValue(status)},${csvValue(count)}`);
    });
    lines.push("");

    lines.push("Timeline");
    lines.push("Month,Event Count,Interested Count");
    (analytics.timeline || []).forEach((entry) => {
        lines.push(
            `${csvValue(entry.month)},${csvValue(entry.eventCount)},${csvValue(
                entry.interestedCount
            )}`
        );
    });
    lines.push("");

    lines.push("Categories");
    lines.push("Category,Event Count");
    (analytics.categories || []).forEach((item) => {
        lines.push(`${csvValue(item.category)},${csvValue(item.count)}`);
    });
    lines.push("");

    lines.push("Top Events");
    lines.push("Event ID,Title,Start Time,End Time,Interested Users,Status");
    (analytics.topEvents || []).forEach((event) => {
        lines.push(
            [
                csvValue(event.event_id),
                csvValue(event.event_title),
                csvValue(event.start_time),
                csvValue(event.end_time),
                csvValue(event.interested_count),
                csvValue(event.status),
            ].join(",")
        );
    });

    return `${lines.join("\r\n")}\r\n`;
}

function sanitizeCategoryIds(input) {
    if (!Array.isArray(input)) return [];
    const ids = input
        .map((value) => {
            const trimmed = String(value ?? "").trim();
            if (!trimmed) return null;
            const num = Number(trimmed);
            if (Number.isFinite(num) && String(num) === trimmed) return num;
            return trimmed;
        })
        .filter((id) => id !== null);
    return Array.from(new Set(ids));
}

async function fetchEvent(eventId) {
    const { data, error } = await supabase
        .from("events")
        .select(
            `
            event_id,
            event_title,
            description,
            location,
            start_time,
            end_time,
            interested_count,
            event_categories (
                category_id,
                category:categories ( category_id, category_name )
            )
        `
        )
        .eq("event_id", eventId)
        .single();

    if (error) throw error;
    return mapEventRow(data);
}

async function getNextEventId() {
    const { data, error } = await supabase
        .from("events")
        .select("event_id")
        .order("event_id", { ascending: false })
        .limit(1);

    if (error) throw error;

    const currentMax = data && data.length > 0 ? Number(data[0].event_id) : 0;
    const next = Number.isFinite(currentMax) ? currentMax + 1 : 1;
    return next;
}

router.get("/events", async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from("events")
            .select(
                `
                event_id,
                event_title,
                description,
                location,
                start_time,
                end_time,
                interested_count,
                event_categories (
                    category_id,
                    category:categories ( category_id, category_name )
                )
            `
            )
            .order("start_time", { ascending: true });

        if (error) throw error;

        const events = (data || []).map(mapEventRow);
        res.json({ items: events, total: events.length });
    } catch (err) {
        console.error("Admin GET /events error:", err.message);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

router.get("/analytics", async (req, res) => {
    try {
        const { startDate, endDate } = parseDateFilters(req.query || {});
        const categoryIds = parseCategoryFilter(req.query?.categories);
        const format = String(req.query?.format || "").trim().toLowerCase();

        let eventQuery = supabase.from("events").select(
            `
                event_id,
                event_title,
                description,
                location,
                start_time,
                end_time,
                interested_count,
                event_categories (
                    category_id,
                    category:categories ( category_id, category_name )
                )
            `
        );

        if (startDate) {
            eventQuery = eventQuery.gte("start_time", startDate.toISOString());
        }

        if (endDate) {
            eventQuery = eventQuery.lte("start_time", endDate.toISOString());
        }

        if (categoryIds.length) {
            const { data: mapping, error: mappingError } = await supabase
                .from("event_categories")
                .select("event_id")
                .in("category_id", categoryIds);
            if (mappingError) throw mappingError;

            const eventIds = Array.from(
                new Set((mapping || []).map((row) => row.event_id).filter((id) => id !== null))
            );

            if (!eventIds.length) {
                const emptyAnalytics = buildAnalytics([], { startDate, endDate });
                const filters = {
                    start: startDate ? startDate.toISOString() : null,
                    end: endDate ? endDate.toISOString() : null,
                    categories: categoryIds,
                };

                if (format === "csv") {
                    const csvPayload = analyticsToCsv(emptyAnalytics, filters);
                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader(
                        "Content-Disposition",
                        "attachment; filename=analytics-export.csv"
                    );
                    return res.status(200).send(csvPayload);
                }

                return res.json({ ...emptyAnalytics, filters });
            }

            eventQuery = eventQuery.in("event_id", eventIds);
        }

        const { data, error } = await eventQuery;

        if (error) throw error;

        const events = (data || []).map(mapEventRow);
        const analytics = buildAnalytics(events, { startDate, endDate });
        const filters = {
            start: startDate ? startDate.toISOString() : null,
            end: endDate ? endDate.toISOString() : null,
            categories: categoryIds,
        };

        if (format === "csv") {
            const csvPayload = analyticsToCsv(analytics, filters);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=analytics-export.csv");
            return res.status(200).send(csvPayload);
        }

        res.json({ ...analytics, filters });
    } catch (err) {
        console.error("Admin GET /analytics error:", err.message);
        res.status(500).json({ error: "Failed to build analytics" });
    }
});

router.get("/events/:id", async (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
    }

    try {
        const event = await fetchEvent(eventId);
        res.json(event);
    } catch (err) {
        if (err?.code === "PGRST116") {
            return res.status(404).json({ error: "Event not found" });
        }
        console.error("Admin GET /events/:id error:", err.message);
        res.status(500).json({ error: "Failed to load event" });
    }
});

router.post("/events", async (req, res) => {
    const {
        event_title,
        description,
        location,
        start_time,
        end_time,
        categories,
        event_id,
    } = req.body || {};

    if (!event_title || !start_time || !end_time) {
        return res.status(400).json({
            error: "event_title, start_time and end_time are required",
        });
    }

    try {
        let newEventId = Number(event_id);
        if (!Number.isFinite(newEventId)) {
            newEventId = await getNextEventId();
        }

        const { data: inserted, error: insertError } = await supabase
            .from("events")
            .insert([
                {
                    event_id: newEventId,
                    event_title,
                    description: description ?? null,
                    location: location ?? null,
                    start_time,
                    end_time,
                },
            ])
            .select("event_id")
            .single();

        if (insertError) throw insertError;

        const eventId = inserted.event_id;
        const categoryIds = sanitizeCategoryIds(categories);

        if (categoryIds.length) {
            const rows = categoryIds.map((category_id) => ({
                event_id: eventId,
                category_id,
            }));
            const { error: catError } = await supabase
                .from("event_categories")
                .insert(rows);
            if (catError) {
                await supabase.from("events").delete().eq("event_id", eventId);
                throw catError;
            }
        }

        const event = await fetchEvent(eventId);
        res.status(201).json(event);
    } catch (err) {
        console.error("Admin POST /events error:", err.message);
        res.status(500).json({ error: "Failed to create event" });
    }
});

router.put("/events/:id", async (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
    }

    const {
        event_title,
        description,
        location,
        start_time,
        end_time,
        categories,
    } = req.body || {};

    try {
        const updates = {};
        if (event_title !== undefined) updates.event_title = event_title;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        if (start_time !== undefined) updates.start_time = start_time;
        if (end_time !== undefined) updates.end_time = end_time;

        if (Object.keys(updates).length) {
            const { error: updateError } = await supabase
                .from("events")
                .update(updates)
                .eq("event_id", eventId);
            if (updateError) throw updateError;
        }

        if (categories !== undefined) {
            const categoryIds = sanitizeCategoryIds(categories);
            const { error: deleteError } = await supabase
                .from("event_categories")
                .delete()
                .eq("event_id", eventId);
            if (deleteError) throw deleteError;

            if (categoryIds.length) {
                const rows = categoryIds.map((category_id) => ({
                    event_id: eventId,
                    category_id,
                }));
                const { error: insertError } = await supabase
                    .from("event_categories")
                    .insert(rows);
                if (insertError) throw insertError;
            }
        }

        const event = await fetchEvent(eventId);
        res.json(event);
    } catch (err) {
        if (err?.code === "PGRST116") {
            return res.status(404).json({ error: "Event not found" });
        }
        console.error("Admin PUT /events/:id error:", err.message);
        res.status(500).json({ error: "Failed to update event" });
    }
});

router.delete("/events/:id", async (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
    }

    try {
        await supabase.from("event_categories").delete().eq("event_id", eventId);
        await supabase.from("interested_events").delete().eq("event_id", eventId);
        await supabase.from("event_photos").delete().eq("event_id", eventId);
        await supabase.from("feedback").delete().eq("event_id", eventId);

        const { error } = await supabase
            .from("events")
            .delete()
            .eq("event_id", eventId);
        if (error) throw error;

        res.status(204).end();
    } catch (err) {
        console.error("Admin DELETE /events/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete event" });
    }
});

module.exports = router;
