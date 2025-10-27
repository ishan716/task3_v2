import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiJSON } from "../src/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ user_name: "", email: "", password: "" });
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
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "register" ? {
        user_name: form.user_name.trim(),
        email: form.email.trim(),
        password: form.password
      } : {
        email: form.email.trim(),
        password: form.password
      };

      const res = await apiJSON("POST", path, payload);
const token = res?.token;
if (token) localStorage.setItem("accessToken", token);

// ✅ Save user_id correctly no matter backend structure
const userId = res?.user_id || res?.user?.user_id;
if (userId) {
  localStorage.setItem("user_id", userId);
  console.log("✅ Logged in user ID saved:", userId);
}

navigate("/", { replace: true });


    } catch (err) {
      setError("Authentication failed. Please check details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {mode === "login" ? "Sign in to continue" : "Register and you’ll be signed in automatically"}
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-2">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm mb-1" htmlFor="user_name">Name</label>
              <input
                id="user_name"
                name="user_name"
                type="text"
                value={form.user_name}
                onChange={onChange}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Doe"
              />
            </div>
          )}

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
              placeholder="you@example.com"
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
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-center">
          {mode === "login" ? (
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => setMode("register")}
            >
              Don’t have an account? Register
            </button>
          ) : (
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => setMode("login")}
            >
              Already have an account? Sign in
            </button>
          )}
          <div className="mt-2">
            <Link to="/admin/login" className="text-blue-600 hover:underline">
              Are you an admin? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
