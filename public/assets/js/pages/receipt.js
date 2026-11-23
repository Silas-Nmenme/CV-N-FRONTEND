import { html, $ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle } from "../core/ui.js";
import { naira, dateTime, METHOD_LABEL } from "../core/format.js";
import { OrderTokens, loadSession } from "../core/state.js";

const cfg = await initLayout();
const app = $("#app"); app.className = "";
await loadSession();
const params = new URLSearchParams(location.search);
const ref = params.get("ref");
try {
  const { order: o, store } = await get(`/orders/${encodeURIComponent(ref)}/receipt`, { t: params.get("t") || OrderTokens.get(ref) });
  setTitle(`Receipt ${o.receiptNumber}`, cfg.store.name);
  app.innerHTML = html`<div class="wrap"><div class="receipt"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><h1 style="margin-bottom:4px">${store.name}</h1><div class="small muted">${store.address}<br>${store.phone} ${store.email ? " · " + store.email : ""}</div></div><div style="text-align:right"><h2 style="margin:0">Receipt</h2><div class="small">${o.receiptNumber}<br>Order ${o.reference}<br>Paid ${dateTime(o.payment.paidAt)}</div></div></div>
  <hr class="divider"><div class="small"><b>Billed to:</b> ${o.customer.fullName}, ${o.customer.email}, ${o.customer.phone}<br><b>${o.shipping.pickup ? "Pickup" : "Delivered to"}:</b> ${o.shipping.pickup ? "Store pickup" : `${o.shipping.address}, ${o.shipping.city}, ${o.shipping.state}`}</div>
  <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${o.items.map((i) => html`<tr><td>${i.name}<div class="small muted">${Object.values(i.attrs || {}).join(" · ")}</div></td><td class="r">${i.quantity}</td><td class="r">${naira(i.unitPrice)}</td><td class="r">${naira(i.lineTotal)}</td></tr>`)}</tbody></table>
  <div style="max-width:280px;margin-left:auto"><div class="sum-row"><span>Subtotal</span><span>${naira(o.subtotal)}</span></div>${o.discount ? html`<div class="sum-row"><span>Discount</span><span>-${naira(o.discount)}</span></div>` : ""}<div class="sum-row"><span>Delivery</span><span>${o.shippingFee ? naira(o.shippingFee) : "Free"}</span></div><div class="sum-row total"><span>Total paid</span><span>${naira(o.total)}</span></div></div>
  <p class="small muted">Payment method: ${METHOD_LABEL[o.payment.method] || o.payment.method}. Thank you for shopping with ${store.name}.</p>
  <div class="no-print" style="margin-top:18px"><button class="btn btn-primary" id="print">${icon("print")} Print / save as PDF</button> <a class="btn btn-ghost" href="/order?ref=${o.reference}${params.get("t") ? "&t=" + params.get("t") : ""}">Back to order</a></div></div></div>`.toString();
  $("#print")?.addEventListener("click", () => window.print());
} catch (e) {
  app.innerHTML = html`<div class="wrap empty"><h1>Receipt unavailable</h1><p>${e.message}</p><a class="btn btn-primary" href="/track-order">Track an order</a></div>`.toString();
}
