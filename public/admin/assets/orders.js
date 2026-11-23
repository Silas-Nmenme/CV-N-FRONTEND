import { html, raw, $, $$, icon, api, naira, table, pager, field, dt } from "./lib.js";
import { register, can } from "./admin.js";
import { toast, modal, confirmDialog, withLoading, formAlert, clearAlert } from "/assets/js/core/ui.js";
import { STATUS_LABEL, METHOD_LABEL } from "/assets/js/core/format.js";
import { apiUrl, assetUrl } from "/assets/js/core/api.js";

const pill = (s) => html`<span class="status-pill st-${s}">${STATUS_LABEL[s] || s}</span>`;
const NEXT = { pending_payment: ["cancelled"], confirmed: ["processing", "dispatched", "cancelled", "refunded"], processing: ["dispatched", "cancelled", "refunded"], dispatched: ["delivered", "refunded"], delivered: ["refunded"], cancelled: [], refunded: [] };

register("orders", async (view, parts, query) => {
  if (parts[0]) return detail(view, parts[0]);
  const st = { page: 1, q: "", status: query.get("status") || "", paymentStatus: query.get("pay") || "", method: "", from: "", to: "" };
  view.innerHTML = html`<div class="a-head"><h1>Orders</h1>${can("reports") ? html`<a class="btn btn-ghost" id="export" href="#">Export CSV</a>` : ""}</div>
  <div class="filters-row"><input class="input grow" id="q" type="search" placeholder="Search reference, name, email or phone">
  <select class="select" id="status"><option value="">All statuses</option>${Object.entries(STATUS_LABEL).filter(([k]) => ["pending_payment", "confirmed", "processing", "dispatched", "delivered", "cancelled", "refunded"].includes(k)).map(([k, l]) => html`<option value="${k}" ${st.status === k ? "selected" : ""}>${l}</option>`)}</select>
  <select class="select" id="paymentStatus"><option value="">Any payment</option><option value="paid" ${st.paymentStatus === "paid" ? "selected" : ""}>Paid</option><option value="pending">Pending</option><option value="awaiting_confirmation" ${st.paymentStatus === "awaiting_confirmation" ? "selected" : ""}>Awaiting confirmation</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>
  <select class="select" id="method"><option value="">Any method</option><option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option><option value="bank_transfer">Bank transfer</option></select>
  <input class="input" id="from" type="date" aria-label="From date"><input class="input" id="to" type="date" aria-label="To date"></div><div id="list"></div>`.toString();
  const load = async () => {
    const r = await api("/orders", { query: st });
    $("#list").innerHTML = html`${table([
      { h: "Order", f: (o) => html`<a href="#/orders/${o.reference}"><b>${o.reference}</b></a><div class="sub">${dt(o.createdAt)}</div>` },
      { h: "Customer", f: (o) => html`${o.customer.fullName}<div class="sub">${o.customer.phone}</div>` },
      { h: "Items", f: (o) => o.items.reduce((s, i) => s + i.quantity, 0) },
      { h: "Payment", f: (o) => html`${pill(o.payment.status)}<div class="sub">${METHOD_LABEL[o.payment.method] || o.payment.method}</div>` },
      { h: "Status", f: (o) => pill(o.status) }, { h: "Total", r: true, f: (o) => html`<b>${naira(o.total)}</b>` },
    ], r.orders, { empty: "No orders match these filters." })}<p class="muted small" style="margin-top:10px">${r.total} order${r.total === 1 ? "" : "s"}</p>${pager(r.page, r.pages)}`.toString();
  };
  let tmr;
  $("#q").oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value; st.page = 1; load(); }, 300); };
  for (const id of ["status", "paymentStatus", "method", "from", "to"]) $("#" + id).onchange = (e) => { st[id] = e.target.value; st.page = 1; load(); };
  view.onclick = (e) => { const pg = e.target.closest("[data-pg]"); if (pg) { st.page = Number(pg.dataset.pg); load(); } };
  $("#export")?.addEventListener("click", (e) => { e.preventDefault(); const q = new URLSearchParams(Object.entries(st).filter(([k, v]) => v && k !== "page")); location.href = `${apiUrl("/api/admin/orders/export.csv")}?${q}`; });
  load();
});

async function detail(view, ref) {
  const { order: o, payments } = await api(`/orders/${encodeURIComponent(ref)}`);
  const canWrite = can("orders:update");
  const bank = o.payment.method === "bank_transfer";
  const next = NEXT[o.status] || [];
  const needsConfirm = o.payment.status !== "paid" && (bank || o.payment.status === "awaiting_confirmation") && !["cancelled", "refunded"].includes(o.status);
  const gateway = ["paystack", "flutterwave"].includes(o.payment.method) && o.payment.status !== "paid" && o.status === "pending_payment";

  view.innerHTML = html`<div class="a-head"><div><a href="#/orders" class="small">← Orders</a><h1>${o.reference} ${pill(o.status)}</h1><div class="muted small">Placed ${dt(o.createdAt)}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${o.payment.status === "paid" ? html`<a class="btn btn-ghost" target="_blank" href="/receipt?ref=${o.reference}">${icon("print")} Receipt</a>` : ""}</div></div>
  ${o.payment.status === "awaiting_confirmation" ? html`<div class="alert alert-warn"><b>Needs your attention.</b> ${o.payment.transferNote || "Payment is awaiting manual confirmation."}</div>` : ""}
  ${o.status === "cancelled" && o.payment.status === "paid" ? html`<div class="alert alert-error"><b>Refund required.</b> This paid order was cancelled. Refund the customer, then mark the order as refunded.</div>` : ""}
  <div class="a-grid"><div style="display:grid;gap:20px">
    <div class="card-a"><h2>Items</h2>${table([
      { h: "Item", f: (i) => html`<div style="display:flex;gap:10px;align-items:center"><img class="th" src="${assetUrl(i.image)}" alt=""><div><span class="name">${i.name}</span><div class="sub">${Object.values(i.attrs || {}).join(" · ")} · SKU ${i.sku}</div></div></div>` },
      { h: "Qty", f: (i) => i.quantity }, { h: "Price", r: true, f: (i) => naira(i.unitPrice) }, { h: "Total", r: true, f: (i) => naira(i.lineTotal) }], o.items)}
      <div style="max-width:300px;margin-left:auto;margin-top:12px"><div class="sum-row"><span>Subtotal</span><span>${naira(o.subtotal)}</span></div>${o.discount ? html`<div class="sum-row"><span>Discount ${o.couponCode ? `(${o.couponCode})` : ""}</span><span>-${naira(o.discount)}</span></div>` : ""}<div class="sum-row"><span>Delivery</span><span>${naira(o.shippingFee)}</span></div><div class="sum-row total"><span>Total</span><span>${naira(o.total)}</span></div></div></div>
    <div class="card-a"><h2>History</h2><ul class="mini-list">${[...o.statusHistory].reverse().map((h) => html`<li><span>${pill(h.status)} ${h.note ? html`<span class="small">${h.note}</span>` : ""}</span><span class="muted small">${dt(h.at)} · ${h.by}</span></li>`)}</ul></div>
    <div class="card-a"><h2>Payment attempts</h2>${payments.length ? table([{ h: "Reference", f: (p) => p.reference }, { h: "Provider", f: (p) => p.provider }, { h: "Amount", f: (p) => naira(p.amount) }, { h: "Status", f: (p) => html`<span class="tag ${p.status === "success" ? "tag-ok" : p.status === "failed" ? "tag-out" : ""}">${p.status}</span>` }, { h: "Detail", f: (p) => p.gatewayMessage || "" }, { h: "When", f: (p) => dt(p.createdAt) }], payments) : html`<p class="muted">No online payment attempts${bank ? " (bank transfer order)" : ""}.</p>`}</div></div>
  <div style="display:grid;gap:20px;align-content:start">
    <div class="card-a"><h2>Actions</h2>${canWrite ? html`<div style="display:grid;gap:10px">
      ${needsConfirm ? html`<button class="btn btn-primary" id="confirm-pay">${icon("check")} Confirm payment received</button>` : ""}
      ${gateway ? html`<button class="btn btn-primary" id="recheck">Re-check payment with gateway</button>` : ""}
      ${next.filter((s) => s !== "cancelled").map((s) => html`<button class="btn btn-ghost" data-status="${s}" ${o.payment.status !== "paid" && s !== "refunded" ? "disabled" : ""}>Mark as ${STATUS_LABEL[s].toLowerCase()}</button>`)}
      ${next.includes("cancelled") ? html`<button class="btn btn-danger" data-status="cancelled">Cancel order</button>` : ""}
      ${!next.length && !needsConfirm && !gateway ? html`<p class="muted small">No further actions for this order.</p>` : ""}
      ${o.payment.status !== "paid" && !["cancelled", "refunded"].includes(o.status) ? html`<p class="small muted">Orders can be moved forward once payment is confirmed.</p>` : ""}</div>` : html`<p class="muted">You have view-only access to orders.</p>`}</div>
    <div class="card-a"><h2>Customer</h2><p style="margin:0"><b>${o.customer.fullName}</b><br>${o.customer.email}<br>${o.customer.phone}${o.user ? html`<br><a href="#/customers/${o.user._id}">View account</a>` : html`<br><span class="muted small">Guest checkout</span>`}</p>
      <hr class="divider"><b>${o.shipping.pickup ? "Store pickup" : "Delivery address"}</b><p style="margin:4px 0 0">${o.shipping.pickup ? "Customer collects from the store." : html`${o.shipping.address}<br>${o.shipping.city}, ${o.shipping.state}`}</p>
      <p class="small muted" style="margin:8px 0 0">${o.shipping.methodName}${o.shipping.zoneName ? ` · ${o.shipping.zoneName}` : ""}${o.shipping.etaText ? ` · ${o.shipping.etaText}` : ""}</p>${o.shipping.notes ? html`<p class="small" style="margin:8px 0 0"><b>Note:</b> ${o.shipping.notes}</p>` : ""}</div>
    <div class="card-a"><h2>Payment</h2><dl class="kv" style="grid-template-columns:110px 1fr"><dt>Method</dt><dd>${METHOD_LABEL[o.payment.method] || o.payment.method}</dd><dt>Status</dt><dd>${pill(o.payment.status)}</dd>${o.payment.paidAt ? html`<dt>Paid</dt><dd>${dt(o.payment.paidAt)}</dd>` : ""}${o.payment.channel ? html`<dt>Channel</dt><dd>${o.payment.channel}</dd>` : ""}${o.receiptNumber ? html`<dt>Receipt</dt><dd>${o.receiptNumber}</dd>` : ""}</dl></div>
    ${o.dispatch?.courier ? html`<div class="card-a"><h2>Dispatch</h2><dl class="kv" style="grid-template-columns:110px 1fr"><dt>Courier</dt><dd>${o.dispatch.courier}</dd><dt>Tracking</dt><dd>${o.dispatch.trackingUrl ? html`<a href="${o.dispatch.trackingUrl}" target="_blank" rel="noopener">${o.dispatch.trackingNumber || "Track"}</a>` : o.dispatch.trackingNumber || "—"}</dd><dt>Sent</dt><dd>${dt(o.dispatch.dispatchedAt)}</dd></dl></div>` : ""}</div></div>`.toString();

  const reload = () => detail(view, ref);
  $("#confirm-pay")?.addEventListener("click", () => {
    const m = modal({ title: "Confirm payment received", body: html`<form novalidate><p>Only confirm after you have seen the money in your account. The amount must match the order total exactly.</p><div class="field"><label for="amt">Amount received (₦)</label><input class="input" id="amt" name="amountReceived" type="number" step="any" value="${o.total}"></div><div class="field"><label for="note">Note (optional)</label><input class="input" id="note" name="note" placeholder="e.g. Transfer ref / sender"></div><button class="btn btn-primary btn-block" type="submit">Confirm payment</button></form>` });
    const f = m.el.querySelector("form");
    f.onsubmit = async (e) => { e.preventDefault(); clearAlert(f); await withLoading(f.querySelector("button"), async () => { try { await api(`/orders/${ref}/confirm-payment`, { method: "POST", body: { amountReceived: Number(f.amountReceived.value), note: f.note.value || undefined } }); m.close(); toast("Payment confirmed"); reload(); } catch (err) { formAlert(f, err.message); } }); };
  });
  $("#recheck")?.addEventListener("click", async (e) => { await withLoading(e.currentTarget, async () => { try { const r = await api(`/orders/${ref}/verify-payment`, { method: "POST" }); toast(r.status === "success" ? "Payment verified and order confirmed" : `Gateway says: ${r.status}`, r.status === "success" ? "ok" : "err"); reload(); } catch (err) { toast(err.message, "err"); } }); });
  $$("[data-status]").forEach((b) => b.addEventListener("click", () => statusModal(b.dataset.status)));

  function statusModal(status) {
    const dispatching = status === "dispatched", cancelling = status === "cancelled", refunding = status === "refunded";
    const m = modal({ title: `${cancelling ? "Cancel order" : "Mark as " + STATUS_LABEL[status].toLowerCase()}`, body: html`<form novalidate>
      ${dispatching ? html`<div class="field"><label for="courier">Courier or rider</label><input class="input" id="courier" name="courier" placeholder="e.g. GIG Logistics, own rider" value="${o.dispatch?.courier || ""}"></div><div class="form-grid"><div class="field"><label for="trackingNumber">Tracking number</label><input class="input" id="trackingNumber" name="trackingNumber"></div><div class="field"><label for="trackingUrl">Tracking link (optional)</label><input class="input" id="trackingUrl" name="trackingUrl" placeholder="https://"></div></div>` : ""}
      ${cancelling && o.payment.status === "paid" ? html`<div class="alert alert-warn">This order is paid. Cancelling returns the stock. Tick the box below once you have refunded the customer.</div><label class="check" style="margin-bottom:14px"><input type="checkbox" name="refund"> I have refunded the customer</label>` : ""}
      ${refunding ? html`<div class="alert alert-warn">Use this after you have refunded the customer through your payment provider or bank. Returned goods are not restocked automatically.</div>` : ""}
      <div class="field"><label for="note">${cancelling ? "Reason" : "Note to customer (optional)"}</label><input class="input" id="note" name="note" maxlength="500"></div>
      <p class="small muted">${["dispatched", "delivered", "cancelled", "refunded"].includes(status) ? "The customer will be emailed about this change." : ""}</p>
      <button class="btn ${cancelling ? "btn-danger" : "btn-primary"} btn-block" type="submit">Confirm</button></form>` });
    const f = m.el.querySelector("form");
    f.onsubmit = async (e) => {
      e.preventDefault(); clearAlert(f);
      const body = { status, note: f.note.value || undefined };
      if (dispatching) Object.assign(body, { courier: f.courier.value, trackingNumber: f.trackingNumber.value || undefined, trackingUrl: f.trackingUrl.value || "" });
      if (f.refund) body.refund = f.refund.checked;
      await withLoading(f.querySelector("button[type=submit]"), async () => { try { await api(`/orders/${ref}/status`, { method: "PATCH", body }); m.close(); toast("Order updated"); reload(); } catch (err) { formAlert(f, err.message); } });
    };
  }
}
