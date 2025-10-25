import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJSON } from "../src/api.js";
import { saveSession } from "../src/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (isSignup && !userName.trim()) {
      setError("Please provide your name");
      return;
    }
    setLoading(true);
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const payload = isSignup
        ? { user_name: userName.trim(), email, password }
        : { email, password };

      const response = await apiJSON("POST", endpoint, payload);
      saveSession({ token: response.token, user: response.user });
      const redirectTarget =
        response.redirectTo || (response.user?.is_admin ? "/admin" : "/");
      if (redirectTarget.startsWith("http")) {
        window.location.href = redirectTarget;
      } else {
        navigate(redirectTarget);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            {isSignup ? "Create an account" : "Welcome Back"}
          </h1>
          <p className="text-gray-500">
            {isSignup ? "Register to start using EventSense" : "Sign in to continue to EventSense"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <label className="block text-sm font-medium text-gray-700">
              Name
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Jane Doe"
                required={isSignup}
              />
            </label>
          )}

          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="••••••••"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (isSignup ? "Creating..." : "Signing in...") : isSignup ? "Sign up" : "Sign in"}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500 mb-3">
            Demo users live in the Supabase <code>public.users</code> table.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError("");
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
