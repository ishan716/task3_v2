import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { apiGet, apiJSON } from "../src/api.js";

export default function InterestsDialog({ open, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [cats, mine] = await Promise.all([
          apiGet("/api/interests/categories"),
          apiGet("/api/interests/me").catch(() => ({ categories: [] }))
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setSelected(new Set((mine.categories || []).map(c => c.category_id)));
      } catch (e) {
        console.error(e);
        setError("Couldn’t load categories. Check API URL / CORS / server.");
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const toggle = id => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const submit = async () => {
    const ids = Array.from(selected);
    setSaving(true);
    try {
      await apiJSON("POST", "/api/interests/me", { categories: ids });
      onSaved?.(ids);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Choose your interests</h2>

      {loading ? (
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      ) : error ? (
        <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200 text-sm">
          {error}
        </div>
      ) : categories.length === 0 ? (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">No categories available.</div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-auto pr-1 my-4">
          {categories.map(c => (
            <button
              key={c.category_id}
              onClick={() => toggle(c.category_id)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors
                ${selected.has(c.category_id)
                  ? "bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white border-transparent dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500"
                  : "bg-white hover:bg-gradient-to-r hover:from-teal-50 hover:via-sky-50 hover:to-indigo-50 border-gray-300 text-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"}`}
            >
              {c.category_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-900">Not now</button>
        <button onClick={submit} disabled={!selected.size || saving}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white disabled:bg-gray-400 hover:from-teal-500 hover:via-sky-500 hover:to-indigo-500 disabled:hover:bg-gray-400 dark:from-teal-500 dark:via-sky-500 dark:to-indigo-500">
          {saving ? "Saving..." : "Save interests"}
        </button>
      </div>
    </Modal>
  );
}

