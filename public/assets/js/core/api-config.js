const BACKEND_ORIGIN = "https://cv-n-backend.vercel.app";

// The production storefront uses Vercel rewrites for /api and /uploads.
// This keeps the session cookie first-party (SameSite=Lax) on cvgadgets.vercel.app.
const isProductionStorefront = window.location.hostname === "cvgadgets.vercel.app";
export const API_BASE_URL = isProductionStorefront ? "" : BACKEND_ORIGIN;
export const ASSET_BASE_URL = isProductionStorefront ? "" : BACKEND_ORIGIN;
