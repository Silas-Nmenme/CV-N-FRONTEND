import { html, $ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { post } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle } from "../core/ui.js";
import { Cart, OrderTokens } from "../core/state.js";

const cfg = await initLayout();
setTitle("Payment status", cfg.store.name);
const app = $("#app");
app.className = "";
const params = new URLSearchParams(location.search);
const ref = params.get("order");
const gatewayStatus = params.get("status"); // Flutterwave adds status=cancelled when the customer backs out
const tok = OrderTokens.get(ref);
const orderLink = `/order?ref=${encodeURIComponent(ref || "")}${tok ? "&t=" + tok : ""}`;

const view = (kind, title, body, actions) => {
  app.innerHTML = html`<div class="wrap"><div class="panel result-card"><div class="result-icon ${kind}">${icon(kind === "ok" ? "check" : kind === "bad" ? "close" : "clock")}</div><h1>${title}</h1>${body}<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px">${actions}</div></div></div>`.toString();
};

async function check(attempt = 0) {
  if (!ref) return view("bad", "Missing order", html`<p>We couldn't tell which order this is.</p>`, html`<a class="btn btn-primary" href="/track-order">Track an order</a>`);
  view("wait", "Confirming your payment…", html`<p>Please wait while we confirm with the payment provider. Don't close this page.</p><span class="spinner"></span>`, "");
  try {
    const r = await post("/payments/verify", { orderReference: ref });
    if (r.status === "success") {
      Cart.clear();
      return view("ok", "Payment successful", html`<p>Thank you! Your order <b>${ref}</b> is confirmed. We've sent a receipt to your email.</p>`, html`<a class="btn btn-primary" href="${orderLink}">View order</a><a class="btn btn-ghost" href="/receipt?ref=${ref}${tok ? "&t=" + tok : ""}">Receipt</a><a class="btn btn-ghost" href="/shop">Keep shopping</a>`);
    }
    if (r.status === "failed" || gatewayStatus === "cancelled") {
      return view("bad", "Payment not completed", html`<p>${r.message || "Your payment was not completed."} No money was taken for this attempt. Your order is still reserved for a short time, so you can try again.</p>`, html`<a class="btn btn-primary" href="${orderLink}">Try again</a><a class="btn btn-ghost" href="/contact">Contact us</a>`);
    }
    if (attempt < 8) { view("wait", "Still confirming…", html`<p>Your bank hasn't confirmed this payment yet. Checking again…</p><span class="spinner"></span>`, ""); return setTimeout(() => check(attempt + 1), 3500); }
    return view("wait", "We're still waiting for confirmation", html`<p>If money left your account, don't worry: we'll confirm your order automatically as soon as the payment provider tells us. You can also re-check from your order page.</p>`, html`<a class="btn btn-primary" href="${orderLink}">View order</a><button class="btn btn-ghost" id="again">Check again</button>`);
  } catch (e) {
    if (e.status === 409) return view("wait", "Payment needs review", html`<p>${e.message} You do not need to pay again.</p>`, html`<a class="btn btn-primary" href="${orderLink}">View order</a><a class="btn btn-ghost" href="/contact">Contact us</a>`);
    if (e.status === 404) return view("bad", "No payment found", html`<p>We couldn't find a payment attempt for this order.</p>`, html`<a class="btn btn-primary" href="${orderLink}">View order</a>`);
    return view("bad", "We couldn't check your payment", html`<p>${e.message}</p>`, html`<button class="btn btn-primary" id="again">Try again</button><a class="btn btn-ghost" href="${orderLink}">View order</a>`);
  }
}
document.addEventListener("click", (e) => { if (e.target.id === "again") check(0); });
check();
