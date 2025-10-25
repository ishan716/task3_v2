// backend/userinterests.routes.js
const express = require("express");
const supabase = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// ✅ relative paths (because of app.use("/interests", ...))

// GET /interests/me
router.get("/me", async (req, res) => {
  const { data: rows, error } = await supabase
    .from("interested_category")
    .select("category_id")
    .eq("user_id", req.userId);

  if (error) return res.status(500).json({ error: error.message });

  const ids = (rows || []).map(r => r.category_id);
  if (!ids.length) return res.json({ user_id: req.userId, categories: [] });

  const { data: cats, error: cerr } = await supabase
    .from("categories")
    .select("category_id, category_name")
    .in("category_id", ids);

  if (cerr) return res.status(500).json({ error: cerr.message });
  res.json({ user_id: req.userId, categories: cats });
});

// POST /interests/me  {categories: ["C1","C3"]}
router.post("/me", async (req, res) => {
  const categories = Array.isArray(req.body?.categories)
    ? [...new Set(req.body.categories.map(String))]
    : [];

  // replace: delete then insert
  const { error: delErr } = await supabase
    .from("interested_category")
    .delete()
    .eq("user_id", req.userId);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (!categories.length) return res.json({ user_id: req.userId, saved: [] });

  const rows = categories.map(id => ({ user_id: req.userId, category_id: id }));
  const { error: insErr } = await supabase.from("interested_category").insert(rows);
  if (insErr) return res.status(500).json({ error: insErr.message });

  res.json({ user_id: req.userId, saved: categories });
});

// DELETE /interests/me  (clear all)
router.delete("/me", async (req, res) => {
  const { error } = await supabase
    .from("interested_category")
    .delete()
    .eq("user_id", req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ user_id: req.userId, deleted: true });
});

// GET /interests/categories
router.get("/categories", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("category_id, category_name")
    .order("category_name", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []); // must be an ARRAY
});


module.exports = router;
