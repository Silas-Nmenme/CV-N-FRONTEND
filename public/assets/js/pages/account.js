import { html, $, $$, esc } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get, post, patch, put, del, assetUrl } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, toast, modal, confirmDialog, showFieldErrors, formAlert, clearAlert, clearFieldErrors, withLoading } from "../core/ui.js";
import { naira, dateShort } from "../core/format.js";
import { session, loadSession, setUser, Cart, Wish } from "../core/state.js";
import { pill } from "../core/orderView.js";

const cfg = await initLayout();
setTitle("My account", cfg.store.name);
const app = $("#app"); app.className = "";
await loadSession();
if (!session.user) { location.replace("/login?next=/account"); await new Promise(() => {}); }

const TABS = [["orders", "My orders", "box"], ["profile", "Profile", "user"], ["addresses", "Addresses", "pin"], ["password", "Password", "lock"]];
let tab = (location.hash || "#orders").slice(1);
if (!TABS.some(([k]) => k === tab)) tab = "orders";

function shell() {
  app.innerHTML = html`<div class="wrap" style="padding-top:24px"><h1>Hello, ${session.user.name.split(" ")[0]}</h1>
  <div class="account-layout"><nav class="account-nav panel" style="padding:10px" aria-label="Account">
    ${TABS.map(([k, label, ic]) => html`<a href="#${k}" class="${k === tab ? "on" : ""}" data-tab="${k}">${icon(ic)} ${label}</a>`)}
    <a href="/wishlist">${icon("heart")} Wishlist</a>
    ${session.user.isStaff ? html`<a href="/admin">${icon("shield")} Admin dashboard</a>` : ""}
    <button id="logout">${icon("logout")} Sign out</button></nav>
  <section id="tab-body"></section></div></div>`.toString();
}

const views = {
  async orders(box) {
    box.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
    const { orders } = await get("/account/orders");
    box.innerHTML = orders.length ? html`<h2>Order history</h2>${orders.map((o) => html`<div class="order-card"><div class="order-card-head"><div><b>${o.reference}</b><div class="small muted">${dateShort(o.createdAt)} · ${o.items.reduce((s, i) => s + i.quantity, 0)} item(s)</div></div><div style="text-align:right">${pill(o.status)} ${o.status === "pending_payment" ? pill(o.payment.status) : ""}<div style="font-family:var(--font-head);font-weight:700;margin-top:4px">${naira(o.total)}</div></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div class="order-thumbs">${o.items.slice(0, 5).map((i) => html`<img src="${assetUrl(i.image)}" alt="${i.name}" title="${i.name}">`)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-ghost btn-sm" href="/order?ref=${o.reference}">${o.status === "pending_payment" ? "Pay / view" : "Track order"}</a>${o.payment.status === "paid" ? html`<a class="btn btn-ghost btn-sm" href="/receipt?ref=${o.reference}">Receipt</a>` : ""}${o.status === "pending_payment" && o.payment.status === "pending" ? html`<button class="btn btn-danger btn-sm" data-cancel="${o.reference}">Cancel</button>` : ""}</div></div></div>`)}`.toString()
      : html`<div class="empty">${icon("box", "icon-lg")}<h2>No orders yet</h2><p>When you place an order it will show up here.</p><a class="btn btn-primary" href="/shop">Start shopping</a></div>`.toString();
  },
  profile(box) {
    const u = session.user;
    box.innerHTML = html`<div class="panel"><h2 class="panel-title">Personal information</h2><form id="profile-form" novalidate style="max-width:520px"><div class="field"><label for="name">Full name</label><input class="input" id="name" name="name" value="${u.name}"></div><div class="field"><label for="email">Email</label><input class="input" id="email" value="${u.email}" disabled><div class="hint">Contact us if you need to change your email.</div></div><div class="field"><label for="phone">Phone</label><input class="input" id="phone" name="phone" placeholder="0803 123 4567" value="${(u.phone || "").replace("+234", "0")}"></div><button class="btn btn-primary" type="submit">Save changes</button></form></div>`.toString();
  },
  async addresses(box) {
    const { addresses } = await get("/account/addresses");
    box.innerHTML = html`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h2 style="margin:0">Delivery addresses</h2><button class="btn btn-primary btn-sm" data-addr>${icon("plus")} Add address</button></div>
    ${addresses.length ? html`<div class="grid g3" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${addresses.map((a) => html`<div class="addr-card ${a.isDefault ? "def" : ""}"><div style="display:flex;justify-content:space-between"><b>${a.label}</b>${a.isDefault ? html`<span class="tag tag-ok">Default</span>` : ""}</div><p class="small" style="margin:8px 0">${a.fullName}<br>${a.address}, ${a.city}, ${a.state}<br>${a.phone}</p><div style="display:flex;gap:12px"><button class="link-btn small" data-addr="${a._id}">Edit</button><button class="link-btn small" style="color:var(--red)" data-deladdr="${a._id}">Delete</button></div></div>`)}</div>` : html`<div class="empty"><p>No saved addresses yet.</p></div>`}`.toString();
    box._addresses = addresses;
  },
  password(box) {
    box.innerHTML = html`<div class="panel"><h2 class="panel-title">Change password</h2><form id="pw-form" novalidate style="max-width:420px"><div class="field"><label for="currentPassword">Current password</label><input class="input" id="currentPassword" name="currentPassword" type="password" autocomplete="current-password"></div><div class="field"><label for="newPassword">New password</label><input class="input" id="newPassword" name="newPassword" type="password" autocomplete="new-password"><div class="hint">At least 8 characters with a letter and a number.</div></div><button class="btn btn-primary" type="submit">Update password</button></form></div>`.toString();
  },
};

async function show(t) {
  tab = t;
  shell();
  const box = $("#tab-body");
  try { await views[t](box); } catch (e) { box.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; }
}

function addressModal(existing) {
  const a = existing || {};
  const m = modal({ title: existing ? "Edit address" : "Add address", body: html`<form id="addr-form" novalidate><div class="form-grid"><div class="field"><label for="label">Label</label><input class="input" id="label" name="label" value="${a.label || "Home"}"></div><div class="field"><label for="fullName">Recipient name</label><input class="input" id="fullName" name="fullName" value="${a.fullName || session.user.name}"></div><div class="field"><label for="phone">Phone</label><input class="input" id="phone" name="phone" value="${(a.phone || session.user.phone || "").replace("+234", "0")}"></div><div class="field"><label for="state">State</label><select class="select" id="state" name="state"><option value="">Select</option>${cfg.states.map((s) => html`<option ${a.state === s ? "selected" : ""}>${s}</option>`)}</select></div><div class="field full"><label for="city">City / town</label><input class="input" id="city" name="city" value="${a.city || ""}"></div><div class="field full"><label for="address">Address</label><textarea class="textarea" id="address" name="address" style="min-height:70px">${a.address || ""}</textarea></div></div><label class="check" style="margin-bottom:16px"><input type="checkbox" name="isDefault" ${a.isDefault ? "checked" : ""}> Make this my default address</label><button class="btn btn-primary btn-block" type="submit">Save address</button></form>` });
  const f = m.el.querySelector("form");
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); clearAlert(f); clearFieldErrors(f);
    const body = { label: f.label.value, fullName: f.fullName.value, phone: f.phone.value, state: f.state.value, city: f.city.value, address: f.address.value, isDefault: f.isDefault.checked };
    await withLoading(f.querySelector("button[type=submit]"), async () => {
      try { existing ? await put(`/account/addresses/${existing._id}`, body) : await post("/account/addresses", body); m.close(); toast("Address saved"); show("addresses"); }
      catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); }
    });
  });
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  const tb = t.closest("[data-tab]"); if (tb) { e.preventDefault(); history.replaceState(null, "", "#" + tb.dataset.tab); show(tb.dataset.tab); return; }
  if (t.closest("#logout")) { await post("/auth/logout"); setUser(null); Cart.clear(); Wish.reset(); location.href = "/"; return; }
  const c = t.closest("[data-cancel]");
  if (c && (await confirmDialog("Cancel this unpaid order? The items will be released.", "Yes, cancel order"))) { try { await post(`/account/orders/${c.dataset.cancel}/cancel`, {}); toast("Order cancelled"); show("orders"); } catch (err) { toast(err.message, "err"); } return; }
  const ad = t.closest("[data-addr]");
  if (ad) { const list = $("#tab-body")._addresses || []; addressModal(ad.dataset.addr ? list.find((x) => x._id === ad.dataset.addr) : null); return; }
  const dd = t.closest("[data-deladdr]");
  if (dd && (await confirmDialog("Delete this address?", "Delete"))) { try { await del(`/account/addresses/${dd.dataset.deladdr}`); toast("Address deleted"); show("addresses"); } catch (err) { toast(err.message, "err"); } }
});
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "profile-form") {
    e.preventDefault(); clearAlert(f); clearFieldErrors(f);
    await withLoading(f.querySelector("button"), async () => { try { const r = await patch("/account/profile", { name: f.name.value.trim(), phone: f.phone.value.trim() }); setUser(r.user); formAlert(f, "Profile updated.", "ok"); document.querySelector("h1").textContent = `Hello, ${r.user.name.split(" ")[0]}`; } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); } });
  }
  if (f.id === "pw-form") {
    e.preventDefault(); clearAlert(f); clearFieldErrors(f);
    await withLoading(f.querySelector("button"), async () => { try { await post("/account/change-password", { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value }); f.reset(); formAlert(f, "Password changed. Other devices have been signed out.", "ok"); } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); } });
  }
});
window.addEventListener("hashchange", () => { const t = location.hash.slice(1); if (TABS.some(([k]) => k === t) && t !== tab) show(t); });
show(tab);
