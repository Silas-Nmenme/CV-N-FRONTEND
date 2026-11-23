import { html, raw, $, $$, icon, api, naira, table, barChart, dt, esc } from "./lib.js";
import { apiUrl } from "/assets/js/core/api.js";
import { toast, formAlert, clearAlert, withLoading, showFieldErrors, clearFieldErrors } from "/assets/js/core/ui.js";
import { logo } from "/assets/js/core/layout.js";
import { STATUS_LABEL } from "/assets/js/core/format.js";

const root = $("#admin-root");
export const ctx = { user: null, badges: {} };

export const can = (p) => ctx.user && (ctx.user.permissions.includes("*") || ctx.user.permissions.includes(p) || ctx.user.permissions.includes(p.split(":")[0]));

/* ------------------------------ login ------------------------------ */
function loginView(msg) {
  root.innerHTML = html`<div class="login-box"><div class="card-a"><div style="margin-bottom:18px">${logo("CV GADGETS")}</div><h1 style="font-size:1.4rem">Admin sign in</h1><p class="muted small">Authorised staff only.</p>
  <form id="login" novalidate>${msg ? html`<div class="alert alert-error">${msg}</div>` : ""}<div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="username"></div><div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="current-password"></div><button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button></form></div></div>`.toString();
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; clearAlert(f);
    await withLoading(f.querySelector("button"), async () => {
      try {
        const r = await fetch(apiUrl("/api/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email.value.trim(), password: f.password.value }), credentials: "include" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        if (!d.user.isStaff) { await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }); throw new Error("This account does not have admin access."); }
        boot();
      } catch (err) { formAlert(f, err.message); }
    });
  });
}

/* ------------------------------ nav ------------------------------ */
const NAV = [
  ["Overview", [["dashboard", "Dashboard", "home", "dashboard"]]],
  ["Sales", [["orders", "Orders", "box", "orders:read"], ["customers", "Customers", "user", "customers:read"], ["coupons", "Coupons", "tag", "coupons"], ["reports", "Reports", "mapbox", "reports"]]],
  ["Catalogue", [["products", "Products", "cart", "products"], ["categories", "Categories", "filter", "catalog"], ["brands", "Brands", "star", "catalog"], ["reviews", "Reviews", "heart", "reviews"]]],
  ["Store", [["delivery", "Delivery zones", "truck", "delivery"], ["banners", "Homepage banners", "tag", "content"], ["testimonials", "Testimonials", "heart", "content"], ["pages", "Content pages", "info", "content"], ["enquiries", "Enquiries", "mail", "enquiries"], ["subscribers", "Subscribers", "mail", "subscribers"]]],
  ["Admin", [["staff", "Staff accounts", "shield", "*"], ["settings", "Settings", "lock", "content"]]],
];

const views = {};
export const register = (name, fn) => (views[name] = fn);

function shell() {
  root.innerHTML = html`<div class="a-shell"><aside class="a-side" id="side"><div class="logo-wrap">${logo("CV GADGETS")}</div><nav aria-label="Admin">
    ${NAV.map(([g, items]) => { const vis = items.filter(([, , , p]) => (p === "*" ? ctx.user.permissions.includes("*") : can(p))); return vis.length ? html`<div class="grp">${g}</div>${vis.map(([k, l, ic]) => html`<a href="#/${k}" data-nav="${k}">${icon(ic)} ${l}${["orders", "reviews", "enquiries"].includes(k) ? html`<span class="badge hidden" data-badge="${k}"></span>` : ""}</a>`)}` : ""; })}
  </nav></aside>
  <div class="a-main"><header class="a-top"><button class="icon-btn a-menu" id="menu" aria-label="Menu">${icon("menu")}</button><a href="/" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View store ↗</a><div class="who"><span>${ctx.user.name} · <b>${ctx.user.role}</b></span><button class="btn btn-ghost btn-sm" id="signout">Sign out</button></div></header>
  <main class="a-content" id="view"></main></div></div>`.toString();
  $("#menu").onclick = () => $("#side").classList.toggle("open");
  $("#signout").onclick = async () => { await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }); location.reload(); };
}

async function route() {
  const hashFull = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [hash, qstr = ""] = hashFull.split("?");
  const query = new URLSearchParams(qstr);
  const [name, ...rest] = hash.split("/");
  $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === name));
  $("#side").classList.remove("open");
  const view = $("#view");
  const fn = views[name];
  if (!fn) { view.innerHTML = html`<div class="empty"><h2>Page not found</h2></div>`.toString(); return; }
  view.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  document.title = `${name[0].toUpperCase() + name.slice(1)} | Admin | CV GADGETS`;
  try { await fn(view, rest.map(decodeURIComponent), query); } catch (e) {
    if (e.status === 401) return loginView("Your session expired. Please sign in again.");
    view.innerHTML = html`<div class="alert alert-error">${e.message}</div>`.toString();
  }
  window.scrollTo(0, 0);
}

async function refreshBadges() {
  try {
    const s = await api("/stats", { query: { days: 7 } });
    const set = (k, n) => { const b = $(`[data-badge="${k}"]`); if (b) { b.textContent = n; b.classList.toggle("hidden", !n); } };
    set("orders", s.totals.awaitingConfirm); set("reviews", s.totals.pendingReviews); set("enquiries", s.totals.newEnquiries);
  } catch { /* non-critical */ }
}

/* ------------------------------ dashboard ------------------------------ */
register("dashboard", async (view) => {
  const days = Number(sessionStorage.getItem("dash_days") || 30);
  const s = await api("/stats", { query: { days } });
  const t = s.totals;
  view.innerHTML = html`<div class="a-head"><h1>Dashboard</h1><select class="select" id="days" style="width:auto"><option value="7" ${days === 7 ? "selected" : ""}>Last 7 days</option><option value="30" ${days === 30 ? "selected" : ""}>Last 30 days</option><option value="90" ${days === 90 ? "selected" : ""}>Last 90 days</option></select></div>
  <div class="kpis"><div class="kpi"><div class="l">Total revenue</div><div class="v">${naira(t.revenue)}</div><div class="s">${t.sales} paid orders (all time)</div></div>
    <div class="kpi"><div class="l">Total orders</div><div class="v">${t.orders}</div><div class="s">${t.pendingOrders} awaiting payment</div></div>
    <div class="kpi"><div class="l">Customers</div><div class="v">${t.customers}</div></div><div class="kpi"><div class="l">Products</div><div class="v">${t.products}</div></div>
    <div class="kpi ${s.lowStockCount ? "warn" : ""}"><div class="l">Low stock</div><div class="v">${s.lowStockCount}</div><div class="s">products running low</div></div>
    <div class="kpi ${s.outOfStockCount ? "warn" : ""}"><div class="l">Out of stock</div><div class="v">${s.outOfStockCount}</div><div class="s">products unavailable</div></div></div>
  ${t.awaitingConfirm ? html`<div class="alert alert-warn"><b>${t.awaitingConfirm} payment${t.awaitingConfirm > 1 ? "s" : ""}</b> need your confirmation. <a href="#/orders?pay=awaiting_confirmation">Review now</a></div>` : ""}
  <div class="a-grid"><div class="card-a"><h2>Revenue, last ${days} days</h2>${barChart(s.series)}</div>
    <div class="card-a"><h2>Top products</h2>${s.topProducts.length ? html`<ul class="mini-list">${s.topProducts.map((p) => html`<li><span>${p.name}<br><span class="muted small">${p.qty} sold</span></span><b>${naira(p.revenue)}</b></li>`)}</ul>` : html`<p class="muted">No paid orders in this period yet.</p>`}</div></div>
  <div class="a-grid even"><div class="card-a"><h2>Low stock</h2>${s.lowStock.length ? html`<ul class="mini-list">${s.lowStock.map((p) => html`<li><a href="#/products/${p.id}">${p.name}</a><span class="tag tag-low">${p.variants.map((v) => `${v.stock} left`).join(", ")}</span></li>`)}</ul>` : html`<p class="muted">Nothing running low.</p>`}</div>
    <div class="card-a"><h2>Out of stock</h2>${s.outOfStock.length ? html`<ul class="mini-list">${s.outOfStock.map((p) => html`<li><a href="#/products/${p.id}">${p.name}</a><span class="tag tag-out">Out</span></li>`)}</ul>` : html`<p class="muted">Everything is in stock.</p>`}</div></div>
  <div class="card-a"><h2>Recent orders</h2>${s.recentOrders.length ? table([
    { h: "Order", f: (o) => html`<a href="#/orders/${o.reference}"><b>${o.reference}</b></a>` }, { h: "Customer", f: (o) => o.customer.fullName }, { h: "Date", f: (o) => dt(o.createdAt) },
    { h: "Payment", f: (o) => html`<span class="status-pill st-${o.payment.status}">${STATUS_LABEL[o.payment.status]}</span>` }, { h: "Status", f: (o) => html`<span class="status-pill st-${o.status}">${STATUS_LABEL[o.status]}</span>` }, { h: "Total", r: true, f: (o) => naira(o.total) },
  ], s.recentOrders) : html`<p class="muted">No orders yet. They will appear here as customers check out.</p>`}</div>`.toString();
  $("#days").onchange = (e) => { sessionStorage.setItem("dash_days", e.target.value); route(); };
});

/* ------------------------------ boot ------------------------------ */
async function boot() {
  try {
    const r = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
    if (!r.ok) return loginView();
    const { user } = await r.json();
    if (!user.isStaff) return loginView("This account does not have admin access. Sign in with an admin account.");
    ctx.user = user;
  } catch { return loginView("Can't reach the server."); }
  await Promise.all([import("./products.js"), import("./orders.js"), import("./views.js"), import("./settings.js")]);
  shell();
  window.addEventListener("hashchange", route);
  await route();
  refreshBadges();
}
boot();
