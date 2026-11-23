import { html } from "./html.js";
import { icon } from "./icons.js";
import { naira, dateTime, STATUS_LABEL, METHOD_LABEL } from "./format.js";
import { assetUrl } from "./api.js";

const FLOW = [["pending_payment", "Order placed"], ["confirmed", "Payment confirmed"], ["processing", "Being prepared"], ["dispatched", "Dispatched"], ["delivered", "Delivered"]];

export function timeline(o) {
  if (["cancelled", "refunded"].includes(o.status)) {
    const h = [...o.statusHistory].reverse().find((x) => x.status === o.status);
    return html`<div class="alert alert-error"><b>Order ${STATUS_LABEL[o.status].toLowerCase()}.</b> ${h?.note || o.cancelReason || ""}</div>`;
  }
  const idx = Math.max(0, FLOW.findIndex(([s]) => s === o.status));
  const at = (s) => o.statusHistory.find((h) => h.status === s)?.at;
  return html`<div class="timeline">${FLOW.map(([s, label], i) => html`<div class="tl-step ${i < idx || (o.status === "delivered" && i === idx) ? "done" : i === idx ? "current" : ""}"><div class="tl-dot">${i < idx || (o.status === "delivered" && i === idx) ? icon("check") : ""}</div><div><b>${label}</b><span>${at(s) ? dateTime(at(s)) : i === idx ? "In progress" : ""}${s === "dispatched" && o.dispatch?.trackingNumber ? ` · ${o.dispatch.courier}: ${o.dispatch.trackingNumber}` : ""}</span></div></div>`)}</div>`;
}

export const pill = (s) => html`<span class="status-pill st-${s}">${STATUS_LABEL[s] || s}</span>`;

export function itemsAndTotals(o) {
  return html`${o.items.map((i) => html`<div class="sum-item"><img src="${assetUrl(i.image)}" alt="" width="56" height="56"><div><b>${i.name}</b><div class="q">${Object.values(i.attrs || {}).join(" · ")} × ${i.quantity}</div></div><span>${naira(i.lineTotal)}</span></div>`)}
    <div class="divider"></div>
    <div class="sum-row"><span>Subtotal</span><span>${naira(o.subtotal)}</span></div>
    ${o.discount ? html`<div class="sum-row"><span>Discount${o.couponCode ? ` (${o.couponCode})` : ""}</span><span class="disc">-${naira(o.discount)}</span></div>` : ""}
    <div class="sum-row"><span>Delivery</span><span>${o.shippingFee ? naira(o.shippingFee) : "Free"}</span></div>
    <div class="sum-row total"><span>Total</span><span>${naira(o.total)}</span></div>`;
}

export function detailsBlock(o) {
  return html`<dl class="kv"><dt>Order reference</dt><dd>${o.reference}</dd><dt>Placed</dt><dd>${dateTime(o.createdAt)}</dd>
    <dt>Delivery</dt><dd>${o.shipping.methodName}${o.shipping.etaText ? ` · ${o.shipping.etaText}` : ""}</dd>
    <dt>${o.shipping.pickup ? "Pickup" : "Address"}</dt><dd>${o.shipping.pickup ? "Collect from our store" : `${o.shipping.address}, ${o.shipping.city}, ${o.shipping.state}`}</dd>
    <dt>Recipient</dt><dd>${o.customer.fullName} · ${o.customer.phone}</dd>
    <dt>Payment</dt><dd>${METHOD_LABEL[o.payment.method] || o.payment.method} · ${pill(o.payment.status)}</dd></dl>`;
}
