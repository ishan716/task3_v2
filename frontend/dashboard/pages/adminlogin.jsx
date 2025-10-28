import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiJSON } from "../src/api";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiJSON("POST", "/api/auth/admin/login", {
        email: form.email.trim(),
        password: form.password,
      });

      const token = res?.token;
      if (token) localStorage.setItem("accessToken", token);

      // Optionally store admin id
      const adminId = res?.admin?.id || res?.admin_id;
      if (adminId) localStorage.setItem("admin_id", adminId);

      navigate("/admin", { replace: true });
    } catch (err) {
      setError("Admin authentication failed. Please check details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Admin sign in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Sign in with your admin credentials
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-2">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 font-medium"
          >
            {loading ? "Please wait…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-sm text-center">
          <Link to="/login" className="text-blue-600 hover:underline">
            Not an admin? User sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

