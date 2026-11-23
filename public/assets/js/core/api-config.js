const BACKEND_ORIGIN = "https://cv-n-backend.vercel.app";

// Production storefront requests use Vercel's same-origin API proxy for session cookies.
export const API_BASE_URL = window.location.hostname === "cvgadgets.vercel.app" ? "" : BACKEND_ORIGIN;
export const ASSET_BASE_URL = BACKEND_ORIGIN;
