export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const nairaFull = (n) => "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dateShort = (d) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
export const dateTime = (d) => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const qs = () => new URLSearchParams(location.search);
export const STATUS_LABEL = {
  pending_payment: "Awaiting payment", confirmed: "Confirmed", processing: "Being prepared", dispatched: "Dispatched", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
  pending: "Pending", awaiting_confirmation: "Awaiting confirmation", paid: "Paid", failed: "Failed",
};
export const METHOD_LABEL = { paystack: "Card / bank (Paystack)", flutterwave: "Card / bank (Flutterwave)", bank_transfer: "Bank transfer" };
export const COLOUR_HEX = {
  black: "#1b1d22", "space black": "#202226", graphite: "#3a3d42", midnight: "#1f2530", white: "#f4f5f7", silver: "#d9dce1", starlight: "#ece6dc", gold: "#e6d3b3",
  blue: "#3d6ad6", "sierra blue": "#9bb6d3", green: "#4f7a62", pink: "#f0b8c6", red: "#d1343f", purple: "#8f7bd6", "natural titanium": "#b8b3aa", "titanium black": "#2e2f33",
  "titanium gray": "#7e8085", lavender: "#c7b7e6", mint: "#b5e0cf", orange: "#f08a3c", yellow: "#f2d35a", "space gray": "#6d7075", grey: "#8a8d93", gray: "#8a8d93", "deep blue": "#27439a",
};
export const colourHex = (name) => COLOUR_HEX[String(name).toLowerCase()] || "#c4c9d4";
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
