import { API_BASE_URL, ASSET_BASE_URL } from "./api-config.js";

export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

const apiOrigin = API_BASE_URL.trim().replace(/\/+$/, "");
const assetOrigin = ASSET_BASE_URL.trim().replace(/\/+$/, "");
export const apiUrl = (path) => new URL(path, apiOrigin || window.location.origin).toString();
export const assetUrl = (path) => {
  if (!path || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path || "";
  return new URL(path, assetOrigin || apiOrigin || window.location.origin).toString();
};

export async function api(path, { method = "GET", body, query, signal } = {}) {
  let url = apiUrl("/api" + path);
  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") q.set(k, v);
    const s = q.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }
  let res;
  try {
    res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "include", signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("We couldn't reach the server. Check your internet connection and try again.", 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(data.message || "Something went wrong. Please try again.", res.status, data.fields);
  return data;
}
export const get = (p, query) => api(p, { query });
export const post = (p, body) => api(p, { method: "POST", body: body ?? {} });
export const put = (p, body) => api(p, { method: "PUT", body });
export const patch = (p, body) => api(p, { method: "PATCH", body });
export const del = (p) => api(p, { method: "DELETE" });
