import { getToken } from "./auth";

export const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

function buildHeaders(base = {}) {
  const headers = { ...(base || {}) };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiGet(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: buildHeaders(options.headers),
  });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

export async function apiJSON(method, path, body, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    method,
    headers: buildHeaders({
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }),
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
  return r.json();
}
