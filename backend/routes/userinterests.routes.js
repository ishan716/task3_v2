const express = require("express");
const supabase = require("../db");
const verifyToken = require("../middlewares/verifyUser");

const router = express.Router();

function requireUserId(req, res) {
  const userId = req.user?.user_id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

// GET /interests/me
router.get("/me", verifyToken, async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { data: rows, error } = await supabase
    .from("interested_category")
    .select("category_id")
    .eq("user_id", userId); //fetch user's interested categories

  if (error) return res.status(500).json({ error: error.message });

  const ids = (rows || []).map((r) => r.category_id);
  if (!ids.length) return res.json({ user_id: userId, categories: [] });

  const { data: cats, error: cerr } = await supabase
    .from("categories")
    .select("category_id, category_name")
    .in("category_id", ids); //get category details

  if (cerr) return res.status(500).json({ error: cerr.message });
  res.json({ user_id: userId, categories: cats });
});

// POST /interests/me  {categories: ["C1","C3"]}
router.post("/me", verifyToken, async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const categories = Array.isArray(req.body?.categories)
    ? [...new Set(req.body.categories.map(String))]
    : [];

  const { error: delErr } = await supabase
    .from("interested_category")
    .delete()
    .eq("user_id", userId); //clear existing interests
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (!categories.length) return res.json({ user_id: userId, saved: [] });

  const rows = categories.map((id) => ({ user_id: userId, category_id: id }));
  const { error: insErr } = await supabase.from("interested_category").insert(rows);//insert new interests
  if (insErr) return res.status(500).json({ error: insErr.message });

  res.json({ user_id: userId, saved: categories });
});

// DELETE /interests/me  (clear all)
router.delete("/me", verifyToken, async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { error } = await supabase
    .from("interested_category")
    .delete()
    .eq("user_id", userId); //delete all interests
  if (error) return res.status(500).json({ error: error.message });
  res.json({ user_id: userId, deleted: true });
});

// GET /interests/categories
router.get("/categories", async (_req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("category_id, category_name")
    .order("category_name", { ascending: true }); //fetch all categories ordered by name

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
