const express = require("express");
const supabase = require("../db");
const { createNotification} = require("../untils/notify");

const router = express.Router();

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
        await createNotification(
            "system", // or organizer_id if you track who added it
            "New Event Added!",
            `A new event "${event_title}" has been added.`,
            `/events/${eventId}`
            );
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
