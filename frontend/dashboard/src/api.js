export const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(path) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      ...authHeaders(),
    },
  });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

export async function apiJSON(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
  return r.json();
}

export async function apiDelete(path) {
  const r = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`DELETE ${path} -> ${r.status}`);
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
