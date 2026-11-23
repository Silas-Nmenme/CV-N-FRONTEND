import { html, $, $$ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get, post } from "../core/api.js";
import { initLayout, waLink } from "../core/layout.js";
import { setTitle, toast, showFieldErrors, formAlert, withLoading, clearAlert } from "../core/ui.js";
import { naira } from "../core/format.js";
import { OrderTokens, getConfig, loadSession } from "../core/state.js";
import { timeline, pill, itemsAndTotals, detailsBlock } from "../core/orderView.js";

const cfg = await initLayout();
setTitle("Your order", cfg.store.name);
const app = $("#app");
app.className = "";
const params = new URLSearchParams(location.search);
const ref = params.get("ref");
const token = params.get("t") || OrderTokens.get(ref);
const isNew = params.get("new") === "1";
await loadSession();

let order;
async function load() {
  const r = await get(`/orders/${encodeURIComponent(ref)}`, { t: token });
  order = r.order;
}
try { if (!ref) throw new Error("No order reference supplied."); await load(); }
catch (e) {
  app.innerHTML = html`<div class="wrap empty"><h1>We couldn't open that order</h1><p>${e.message === "Order not found." ? "Sign in to the account you ordered with, or track it with your order reference and email or phone number." : e.message}</p><a class="btn btn-primary" href="/track-order">Track an order</a> <a class="btn btn-ghost" href="/login?next=${encodeURIComponent(location.pathname + location.search)}">Sign in</a></div>`.toString();
  throw e;
}

function draw() {
  const o = order;
  const online = ["paystack", "flutterwave"].includes(o.payment.method);
  const canPay = o.status === "pending_payment" && o.payment.status !== "paid";
  const bank = cfg.payments.bank;
  const wa = waLink(cfg, `Hello, I need help with my order ${o.reference}.`);
  app.innerHTML = html`<div class="wrap" style="padding-top:24px;max-width:1000px">
    ${isNew && o.payment.method === "bank_transfer" ? html`<div class="alert alert-ok"><b>Order placed.</b> Complete your bank transfer below so we can confirm it.</div>` : ""}
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:flex-start"><div><h1 style="margin-bottom:4px">Order ${o.reference}</h1><span class="muted">${pill(o.status)}</span></div>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">${o.payment.status === "paid" ? html`<a class="btn btn-ghost" href="/receipt?ref=${o.reference}${token ? "&t=" + token : ""}">${icon("print")} Receipt</a>` : ""}${wa ? html`<a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")} Need help?</a>` : ""}</div></div>
    <div class="cart-layout" style="margin-top:20px"><div style="display:grid;gap:20px">
      <div class="panel"><h2 class="panel-title">Progress</h2>${timeline(o)}</div>
      ${canPay && o.payment.method === "bank_transfer" && bank ? html`<div class="panel"><h2 class="panel-title">Pay by bank transfer</h2><div class="bank-box"><dl><dt>Bank</dt><dd>${bank.bankName}</dd><dt>Account name</dt><dd>${bank.accountName}</dd><dt>Account number</dt><dd>${bank.accountNumber} <button class="link-btn small" data-copy="${bank.accountNumber}">Copy</button></dd><dt>Amount</dt><dd>${naira(o.total)}</dd><dt>Narration</dt><dd>${o.reference}</dd></dl><span class="small">${bank.instructions}</span></div>
        ${o.payment.status === "awaiting_confirmation" ? html`<div class="alert alert-info" style="margin-top:14px">Thanks. We have been told you've paid and will confirm your transfer shortly.</div>` : html`<form id="notice" style="margin-top:16px" novalidate><div class="field"><label for="senderName">Name on the account you paid from</label><input class="input" id="senderName" name="senderName" autocomplete="name"></div><button class="btn btn-primary" type="submit">I've made the transfer</button></form>`}</div>` : ""}
      ${canPay && online ? html`<div class="panel"><h2 class="panel-title">Payment pending</h2><p>${o.payment.status === "awaiting_confirmation" ? "Your payment needs a quick manual review by our team. You do not need to pay again." : "We haven't received a confirmed payment for this order yet. Unpaid orders are released after a short time."}</p>${o.payment.status === "awaiting_confirmation" ? "" : html`<div style="display:flex;gap:8px;flex-wrap:wrap">${cfg.payments.methods.filter((m) => m !== "bank_transfer").map((m) => html`<button class="btn btn-primary" data-pay="${m}">${icon("card")} Pay ${naira(o.total)} with ${m === "paystack" ? "Paystack" : "Flutterwave"}</button>`)}</div>`}<p class="small muted" style="margin-top:12px">Already paid? <button class="link-btn" id="recheck">Check payment status</button></p></div>` : ""}
      <div class="panel"><h2 class="panel-title">Delivery and payment</h2>${detailsBlock(o)}</div></div>
    <aside class="panel summary"><h2 class="panel-title">Items</h2>${itemsAndTotals(o)}</aside></div></div>`.toString();
}
draw();

document.addEventListener("click", async (e) => {
  const c = e.target.closest("[data-copy]");
  if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast("Account number copied"); } catch { toast("Copy failed. Select and copy manually.", "err"); } return; }
  const p = e.target.closest("[data-pay]");
  if (p) await withLoading(p, async () => { try { const r = await post("/payments/initialize", { orderReference: ref, accessToken: token, provider: p.dataset.pay }); location.href = r.url; } catch (err) { toast(err.message, "err"); } });
  if (e.target.id === "recheck") { try { const r = await post("/payments/verify", { orderReference: ref }); await load(); draw(); toast(r.status === "success" ? "Payment confirmed" : "Payment not confirmed yet", r.status === "success" ? "ok" : "err"); } catch (err) { toast(err.message, "err"); } }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "notice") return;
  e.preventDefault();
  const f = e.target; clearAlert(f);
  if (f.senderName.value.trim().length < 2) return showFieldErrors(f, { senderName: "Enter the name on the sending account." });
  await withLoading(f.querySelector("button"), async () => { try { const r = await post(`/orders/${ref}/transfer-notice`, { t: token, senderName: f.senderName.value.trim() }); order = r.order; draw(); toast(r.message); } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); } });
});
