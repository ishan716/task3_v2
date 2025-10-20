import { useState } from "react";
import { API, apiJSON } from "../src/api.js";

export default function AdminLogin() {
  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === "login") {
        const res = await apiJSON("POST", "/admin/login", { email, password });
        const token = res.token;
        if (!token) {
          setMessage("No token received");
          setLoading(false);
          return;
        }
        localStorage.setItem("adminToken", token);
        setMessage("Login successful. Token saved to localStorage.");
      } else {
        // register
        const res = await apiJSON("POST", "/admin/signup", { email, password, full_name: fullName });
        // backend returns message on success
        setMessage(res.massege || res.message || "Registered successfully. You can now sign in.");
        // switch to login so user can sign in
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">{mode === "login" ? "Admin Login" : "Admin Register"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <div>
              <label className="block text-sm font-medium mb-1">Full name</label>
              <input
                className="w-full border px-3 py-2 rounded"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="w-full border px-3 py-2 rounded"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="w-full border px-3 py-2 rounded"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
              disabled={loading}
            >
              {loading ? (mode === "login" ? "Signing in..." : "Registering...") : (mode === "login" ? "Sign in" : "Register")}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(null); }}
              className="ml-auto text-sm text-blue-600 underline"
            >
              {mode === "login" ? "Create admin account" : "Back to login"}
            </button>
          </div>
        </form>

        {message ? (
          <div className="mt-4 p-3 bg-gray-50 border rounded text-sm">{message}</div>
        ) : null}

        <p className="mt-4 text-xs text-gray-500">This page calls /admin/login and /admin/signup. Tokens are saved to localStorage under "adminToken".</p>
      </div>
    </div>
  );
}
