import { html, raw, $, $$, esc } from "./html.js";
import { icon } from "./icons.js";
import { get, post, assetUrl } from "./api.js";
import { naira, debounce } from "./format.js";
import { Cart, Wish, getConfig, loadSession, session, on, setUser, storage } from "./state.js";
import { toast, withLoading } from "./ui.js";

const LOGO = `<svg class="logo-mark" viewBox="0 0 40 34" aria-hidden="true"><rect x="0" y="2" width="35" height="30" rx="9" fill="#2145f5"/><rect x="35" y="11" width="5" height="12" rx="2.5" fill="#ffb400"/><text x="17.5" y="23.2" text-anchor="middle" font-family="Sora,Arial,sans-serif" font-weight="800" font-size="15" fill="#fff" letter-spacing="-.5">CV</text></svg>`;
export const logo = (name) => html`<a class="logo" href="/" aria-label="${name} home">${raw(LOGO)}<span class="logo-word">${(name || "CV GADGETS").split(" ")[0]}<small>${(name || "CV GADGETS").split(" ").slice(1).join(" ") || "GADGETS"}</small></span></a>`;

let CATS = [];
const SOCIAL = [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["x", "X"], ["youtube", "YouTube"]];
export const waLink = (cfg, text = "") => (cfg.store.whatsapp ? `https://wa.me/${cfg.store.whatsapp}${text ? "?text=" + encodeURIComponent(text) : ""}` : "");

function navItems() {
  const out = [];
  for (const c of CATS.filter((c) => c.showInNav)) {
    const kids = c.children.filter((k) => k.showInNav);
    out.push({ ...c, kids });
    for (const k of kids.filter((k) => k.navPromoted)) out.push({ ...k, kids: k.children?.filter((x) => x.showInNav) || [] });
  }
  return out;
}

function headerHtml(cfg) {
  const s = cfg.store;
  const wa = waLink(cfg, `Hello ${s.name}, I'd like to ask about a product.`);
  const items = navItems();
  return html`
  ${s.announcement ? html`<div class="announce">${s.announcement}</div>` : ""}
  <header class="site-header">
    <div class="wrap header-main">
      <div style="display:flex;align-items:center;gap:4px"><button class="icon-btn menu-toggle" data-open-menu aria-label="Open menu">${icon("menu")}</button>${logo(s.name)}</div>
      <div class="search" role="search">
        <form action="/shop" method="get" autocomplete="off"><input type="search" name="q" placeholder="Search iPhone, MacBook, charger…" aria-label="Search products" aria-autocomplete="list" aria-controls="suggest-box" aria-expanded="false" maxlength="60"><button type="submit" aria-label="Search">${icon("search")}</button></form>
        <div class="suggest hidden" id="suggest-box" role="listbox"></div>
      </div>
      <div class="header-actions">
        ${wa ? html`<a class="wa-link" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")}<span>WhatsApp</span></a>` : ""}
        <a class="icon-btn" href="/account" data-account aria-label="Account">${icon("user")}</a>
        <a class="icon-btn" href="/wishlist" aria-label="Wishlist">${icon("heart")}<span class="badge-dot" data-wish-count></span></a>
        <button class="icon-btn" data-open-cart aria-label="Shopping cart">${icon("cart")}<span class="badge-dot" data-cart-count></span></button>
      </div>
    </div>
    <nav class="nav" aria-label="Main"><div class="wrap"><ul class="nav-list">
      ${items.map((c) => html`<li class="nav-item"><a class="nav-link" href="/category/${c.slug}" data-nav="${c.slug}">${c.name}${c.kids.length ? icon("chevron") : ""}</a>${c.kids.length ? html`<div class="nav-drop"><a href="/category/${c.slug}">All ${c.name}</a>${c.kids.map((k) => html`<a href="/category/${k.slug}">${k.name}</a>`)}</div>` : ""}</li>`)}
      <li class="nav-item"><a class="nav-link deal" href="/shop?onOffer=1">${icon("tag")} Offers</a></li>
      <li class="nav-item"><a class="nav-link" href="/track-order">Track order</a></li>
    </ul></div></nav>
  </header>
  <div class="drawer-backdrop" data-backdrop></div>
  <aside class="drawer left" id="menu-drawer" aria-label="Menu" aria-hidden="true"><div class="drawer-head"><span>${logo(s.name)}</span><button class="icon-btn" data-close-drawers aria-label="Close menu">${icon("close")}</button></div>
    <div class="drawer-body mnav">
      ${items.map((c) => c.kids.length ? html`<details><summary>${c.name}${icon("chevron")}</summary><div class="sub"><a href="/category/${c.slug}">All ${c.name}</a>${c.kids.map((k) => html`<a href="/category/${k.slug}">${k.name}</a>`)}</div></details>` : html`<a href="/category/${c.slug}">${c.name}</a>`)}
      <a href="/shop?onOffer=1">Offers</a><a href="/track-order">Track order</a><a href="/wishlist">Wishlist</a><a href="/account" data-account>My account</a><a href="/contact">Contact us</a>
      ${wa ? html`<a href="${wa}" target="_blank" rel="noopener" style="color:var(--green)">Chat on WhatsApp ${icon("whatsapp")}</a>` : ""}
      <a href="/admin" data-staff-link class="hidden">Admin dashboard</a>
    </div></aside>
  <aside class="drawer right" id="cart-drawer" aria-label="Shopping cart" aria-hidden="true"><div class="drawer-head"><h2>Your cart</h2><button class="icon-btn" data-close-drawers aria-label="Close cart">${icon("close")}</button></div><div class="drawer-body" id="mini-cart-body"></div><div class="drawer-foot" id="mini-cart-foot"></div></aside>`;
}

function footerHtml(cfg) {
  const s = cfg.store;
  const socials = SOCIAL.filter(([k]) => s.social?.[k]);
  const top = CATS.filter((c) => c.showInNav);
  return html`
  <div class="footer-news"><div class="wrap"><div><h2>Get offers and new arrivals</h2><p>Join our mailing list. No spam, unsubscribe anytime.</p></div>
    <form class="news-form" id="news-form" novalidate><input class="input" type="email" name="email" placeholder="Your email address" aria-label="Email address" required autocomplete="email"><button class="btn btn-amber" type="submit">Subscribe</button></form></div></div>
  <div class="wrap footer-grid">
    <div><div style="margin-bottom:14px"><a class="logo" href="/" style="color:#fff">${raw(LOGO)}<span class="logo-word">${s.name.split(" ")[0]}<small style="color:#9fb0d9">${s.name.split(" ").slice(1).join(" ") || "GADGETS"}</small></span></a></div>
      <p class="small">${s.tagline}</p>
      ${socials.length ? html`<div class="socials">${socials.map(([k, label]) => html`<a href="${s.social[k]}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${icon(k)}</a>`)}</div>` : ""}</div>
    <div><h3>Shop</h3><ul>${top.map((c) => html`<li><a href="/category/${c.slug}">${c.name}</a></li>`)}<li><a href="/shop?onOffer=1">Offers</a></li><li><a href="/shop?newArrival=1">New arrivals</a></li></ul></div>
    <div><h3>Help</h3><ul><li><a href="/track-order">Track your order</a></li><li><a href="/faq">FAQs</a></li><li><a href="/shipping-policy">Shipping and delivery</a></li><li><a href="/returns-policy">Returns and refunds</a></li><li><a href="/contact">Contact us</a></li></ul></div>
    <div><h3>Contact</h3><ul class="footer-contact">
      ${s.address ? html`<li>${icon("pin")}<span>${s.address}</span></li>` : ""}
      ${s.phone ? html`<li>${icon("phone")}<a href="tel:${s.phone.replace(/\s/g, "")}">${s.phone}</a></li>` : ""}
      ${s.email ? html`<li>${icon("mail")}<a href="mailto:${s.email}">${s.email}</a></li>` : ""}
      ${s.openingHours ? html`<li>${icon("clock")}<span>${s.openingHours}</span></li>` : ""}
      ${!s.address && !s.phone && !s.email ? html`<li><a href="/contact">Send us a message</a></li>` : ""}</ul></div>
  </div>
  <div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} ${s.name}. All prices in Nigerian Naira (₦).</span>
    <span><a href="/privacy-policy">Privacy</a> · <a href="/terms">Terms</a></span>
    <div class="pay-chips" aria-label="Payment options">${cfg.payments.methods.includes("paystack") ? html`<span>Paystack</span>` : ""}${cfg.payments.methods.includes("flutterwave") ? html`<span>Flutterwave</span>` : ""}${cfg.payments.methods.includes("bank_transfer") ? html`<span>Bank transfer</span>` : ""}</div></div>`;
}

/* ------------------------------ mini cart ------------------------------ */
async function renderMiniCart() {
  const body = $("#mini-cart-body"), foot = $("#mini-cart-foot");
  if (!body) return;
  const items = Cart.items();
  if (!items.length) {
    body.innerHTML = html`<div class="empty">${icon("cart", "icon-lg")}<h3>Your cart is empty</h3><p>Add a phone, laptop or charger to get started.</p><a class="btn btn-primary" href="/shop">Start shopping</a></div>`.toString();
    foot.innerHTML = ""; foot.classList.add("hidden");
    return;
  }
  body.innerHTML = `<div class="page-loading" style="min-height:160px"><span class="spinner"></span></div>`;
  try {
    const q = await post("/cart/quote", { items });
    foot.classList.remove("hidden");
    body.innerHTML = html`${q.issues.map((i) => html`<div class="alert alert-warn">${i.message}</div>`)}${q.lines.map((l) => html`<div class="mini-line"><img src="${assetUrl(l.image)}" alt="" width="64" height="64"><div><a class="n" href="/p/${l.slug}" style="color:inherit;text-decoration:none">${l.name}</a><div class="small muted">${Object.values(l.attrs).join(" · ")}</div>
      <div class="qty sm" style="margin-top:8px"><button data-mq="-1" data-pid="${l.productId}" data-sku="${l.sku}" aria-label="Decrease quantity">${icon("minus")}</button><input value="${l.quantity}" readonly aria-label="Quantity"><button data-mq="1" data-pid="${l.productId}" data-sku="${l.sku}" aria-label="Increase quantity">${icon("plus")}</button></div></div>
      <div style="text-align:right"><b>${naira(l.lineTotal)}</b><br><button class="link-btn small" data-mrm data-pid="${l.productId}" data-sku="${l.sku}" style="color:var(--red)">Remove</button></div></div>`)}`.toString();
    foot.innerHTML = html`<div class="sum-row"><span>Subtotal</span><b>${naira(q.subtotal)}</b></div><p class="small muted">Delivery and discounts are calculated at checkout.</p><div style="display:grid;gap:8px"><a class="btn btn-primary btn-block" href="/checkout">Checkout</a><a class="btn btn-ghost btn-block" href="/cart">View cart</a></div>`.toString();
    if (q.issues.length) {
      // keep the stored cart in sync with what is actually available
      Cart.replace(q.lines.map((l) => ({ productId: l.productId, sku: l.sku, quantity: l.quantity })));
    }
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

export function openDrawer(id) {
  $$(".drawer.open").forEach((d) => closeDrawer(d));
  const d = $(id);
  d.classList.add("open"); d.setAttribute("aria-hidden", "false");
  $("[data-backdrop]").classList.add("open");
  document.body.style.overflow = "hidden";
  if (id === "#cart-drawer") renderMiniCart();
  d.querySelector("button,a")?.focus();
}
function closeDrawer(d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
export function closeDrawers() {
  $$(".drawer.open").forEach(closeDrawer);
  $("[data-backdrop]")?.classList.remove("open");
  document.body.style.overflow = "";
}

/* ------------------------------ search ------------------------------ */
function bindSearch() {
  const input = $('.search input[name="q"]'), box = $("#suggest-box");
  if (!input) return;
  const params = new URLSearchParams(location.search);
  if (location.pathname === "/shop" && params.get("q")) input.value = params.get("q");
  let ctl, idx = -1;
  const hide = () => { box.classList.add("hidden"); input.setAttribute("aria-expanded", "false"); idx = -1; };
  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return hide();
    ctl?.abort(); ctl = new AbortController();
    try {
      const r = await get(`/products/suggest?q=${encodeURIComponent(q)}`);
      if (input.value.trim() !== q) return;
      if (!r.products.length && !r.categories.length && !r.brands.length) { box.innerHTML = `<div class="s-head">No matches for “${esc(q)}”. Press Enter to search anyway.</div>`; }
      else box.innerHTML = html`${r.categories.length || r.brands.length ? html`<div class="s-head">Browse</div>${r.categories.map((c) => html`<a href="/category/${c.slug}" role="option">${icon("search")}<span class="s-name">${c.name}</span></a>`)}${r.brands.map((b) => html`<a href="/shop?brand=${b.slug}" role="option">${icon("search")}<span class="s-name">${b.name}</span></a>`)}` : ""}
        ${r.products.length ? html`<div class="s-head">Products</div>${r.products.map((p) => html`<a href="/p/${p.slug}" role="option"><img src="${assetUrl(p.image)}" alt="" width="44" height="44"><span><span class="s-name">${p.name}</span><br><span class="s-price">${naira(p.price)}${p.inStock ? "" : " · Out of stock"}</span></span></a>`)}<a href="/shop?q=${encodeURIComponent(q)}" role="option" style="justify-content:center;color:var(--cobalt);font-weight:700">See all results</a>` : ""}`.toString();
      box.classList.remove("hidden"); input.setAttribute("aria-expanded", "true");
    } catch (e) { if (e.name !== "AbortError") hide(); }
  }, 220);
  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => {
    const links = $$("a", box);
    if (e.key === "Escape") return hide();
    if (!links.length || box.classList.contains("hidden")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.setAttribute("aria-selected", i === idx));
      links[idx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); links[idx].click(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) hide(); });
}

function updateBadges() {
  const c = Cart.count(), w = Wish.count();
  $$("[data-cart-count]").forEach((b) => (b.textContent = c || ""));
  $$("[data-wish-count]").forEach((b) => (b.textContent = w || ""));
}
function updateAccountLinks() {
  const u = session.user;
  $$("[data-account]").forEach((a) => { a.href = u ? "/account" : "/login"; if (a.classList.contains("icon-btn")) a.setAttribute("aria-label", u ? `Account: ${u.name}` : "Sign in"); else a.textContent = u ? "My account" : "Sign in / Register"; });
  $$("[data-staff-link]").forEach((a) => a.classList.toggle("hidden", !u?.isStaff));
}

/* ------------------------------ global actions ------------------------------ */
function bindGlobal(cfg) {
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const add = t.closest("[data-add]");
    if (add && !add.hasAttribute("data-add-custom")) {
      Cart.add(add.dataset.add, add.dataset.sku, 1);
      toast("Added to cart");
      openDrawer("#cart-drawer");
      return;
    }
    const wish = t.closest("[data-wish]");
    if (wish) {
      const id = wish.dataset.wish;
      const on = await Wish.toggle(id);
      $$(`[data-wish="${id}"]`).forEach((b) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Remove from wishlist" : "Add to wishlist"); });
      toast(on ? "Saved to wishlist" : "Removed from wishlist");
      return;
    }
    if (t.closest("[data-open-cart]")) return openDrawer("#cart-drawer");
    if (t.closest("[data-open-menu]")) return openDrawer("#menu-drawer");
    if (t.closest("[data-close-drawers]") || t.matches("[data-backdrop]")) return closeDrawers();
    const mq = t.closest("[data-mq]");
    if (mq) { const l = Cart.items().find((i) => i.productId === mq.dataset.pid && i.sku === mq.dataset.sku); Cart.setQty(mq.dataset.pid, mq.dataset.sku, (l?.quantity || 1) + Number(mq.dataset.mq)); renderMiniCart(); }
    const rm = t.closest("[data-mrm]");
    if (rm) { Cart.remove(rm.dataset.pid, rm.dataset.sku); renderMiniCart(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawers(); });
  on("cart", updateBadges);
  on("wish", updateBadges);
  on("session", () => { updateAccountLinks(); });

  const nf = $("#news-form");
  nf?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = nf.querySelector("button");
    const email = nf.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter a valid email address", "err");
    await withLoading(btn, async () => {
      try { const r = await post("/newsletter/subscribe", { email }); toast(r.message); nf.reset(); } catch (err) { toast(err.message, "err"); }
    });
  });

  if (cfg.store.whatsapp) {
    const a = document.createElement("a");
    a.className = "wa-float"; a.href = waLink(cfg, `Hello ${cfg.store.name}, I need help choosing a gadget.`); a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Chat on WhatsApp");
    a.innerHTML = icon("whatsapp").toString();
    document.body.append(a);
  }
}

/** Build the shell. Returns the config so pages can reuse it. */
export async function initLayout(active) {
  const hdr = $("#site-header"), ftr = $("#site-footer");
  let cfg;
  try {
    const [c, cats] = await Promise.all([getConfig(), get("/categories")]);
    cfg = c; CATS = cats.categories;
  } catch (e) {
    (hdr || document.body).insertAdjacentHTML("afterbegin", `<div class="alert alert-error" style="margin:12px">We're having trouble loading the store. Please refresh the page.</div>`);
    throw e;
  }
  document.documentElement.lang = "en-NG";
  if (hdr) hdr.innerHTML = headerHtml(cfg).toString();
  if (ftr) { ftr.className = "site-footer"; ftr.innerHTML = footerHtml(cfg).toString(); }
  const path = location.pathname.split("/")[2];
  $$("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === (active || path)));
  bindSearch(); bindGlobal(cfg); updateBadges();
  loadSession().then(() => { updateAccountLinks(); if (session.user) { Wish.mergeWithServer(); } });
  return cfg;
}
export const getCategories = () => CATS;
export { setUser };
