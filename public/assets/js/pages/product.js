import { html, $, $$, esc } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get, post, assetUrl } from "../core/api.js";
import { initLayout, waLink, openDrawer } from "../core/layout.js";
import { productCard } from "../core/productCard.js";
import { setTitle, setMeta, stars, toast, showFieldErrors, formAlert, withLoading, clearAlert } from "../core/ui.js";
import { naira, colourHex, dateShort } from "../core/format.js";
import { Cart, Wish, session, loadSession } from "../core/state.js";

const cfg = await initLayout();
const app = $("#app");
const slug = location.pathname.split("/")[2];

let product;
try { product = (await get(`/products/${encodeURIComponent(slug)}`)).product; }
catch (e) {
  app.className = "";
  app.innerHTML = html`<div class="wrap empty"><h1>Product not found</h1><p>${e.message}</p><a class="btn btn-primary" href="/shop">Browse the store</a></div>`.toString();
  throw e;
}
app.className = "";
setTitle(product.name, cfg.store.name);
setMeta((product.description || product.name).slice(0, 155));

const attrDefs = product.attrDefs.filter((d) => product.variants.some((v) => v.attrs?.[d.key]));
const first = product.variants.find((v) => v.stock > 0) || product.variants[0];
let sel = { ...first.attrs };
let qty = 1;
let imgIdx = 0;

const matches = (v, s) => Object.entries(s).every(([k, val]) => v.attrs[k] === val);
const current = () => product.variants.find((v) => matches(v, sel)) || first;

function pickOption(key, value) {
  const cands = product.variants.filter((v) => v.attrs[key] === value);
  const score = (v) => Object.entries(sel).filter(([k, val]) => k !== key && v.attrs[k] === val).length * 10 + (v.stock > 0 ? 5 : 0);
  cands.sort((a, b) => score(b) - score(a));
  if (cands[0]) sel = { ...cands[0].attrs };
}
const optionAvailable = (key, value) => product.variants.some((v) => v.attrs[key] === value && Object.entries(sel).every(([k, val]) => k === key || v.attrs[k] === val));
const optionValues = (key) => [...new Set(product.variants.map((v) => v.attrs[key]).filter(Boolean))];

function stockHtml(v) {
  if (v.stock <= 0) return html`<span class="tag tag-out">Out of stock</span><span class="muted">Message us on WhatsApp to be told when it's back.</span>`;
  if (v.lowStock) return html`<span class="tag tag-low">Only ${v.stock} left</span>`;
  return html`<span class="tag tag-ok">${icon("check")} In stock</span>`;
}

function optsHtml() {
  return attrDefs.map((d) => html`<div class="opt"><div class="opt-label">${d.label}<span>${sel[d.key] || ""}</span></div><div class="opt-list">${optionValues(d.key).map((val) => d.swatch
    ? html`<button class="swatch ${optionAvailable(d.key, val) ? "" : "na"}" style="background:${colourHex(val)}" data-opt="${d.key}" data-val="${val}" aria-pressed="${sel[d.key] === val}" aria-label="${val}" title="${val}"></button>`
    : html`<button class="opt-btn ${optionAvailable(d.key, val) ? "" : "na"}" data-opt="${d.key}" data-val="${val}" aria-pressed="${sel[d.key] === val}">${val}</button>`)}</div></div>`);
}

function buyHtml() {
  const v = current();
  const save = v.comparePrice ? Math.round((1 - v.price / v.comparePrice) * 100) : 0;
  const out = v.stock <= 0;
  const wa = waLink(cfg, `Hello ${cfg.store.name}, I'm interested in the ${product.name} (${Object.values(v.attrs).join(", ")}) at ${naira(v.price)}.\n${location.href}`);
  return html`
    <div class="pdp-price"><span class="now">${naira(v.price)}</span>${v.comparePrice ? html`<span class="was">${naira(v.comparePrice)}</span><span class="save">Save ${save}%</span>` : ""}</div>
    ${optsHtml()}
    ${v.batteryHealth != null ? html`<p class="small" style="margin:0 0 10px">${icon("bolt")} Battery health: <b>${v.batteryHealth}%</b></p>` : ""}
    <div class="stock-line">${stockHtml(v)}</div>
    <div class="buy-row">
      <div class="qty" ${out ? 'aria-disabled="true"' : ""}><button data-q="-1" aria-label="Decrease quantity" ${out ? "disabled" : ""}>${icon("minus")}</button><input id="qty" type="number" inputmode="numeric" min="1" max="${Math.min(10, v.stock || 1)}" value="${qty}" aria-label="Quantity" ${out ? "disabled" : ""}><button data-q="1" aria-label="Increase quantity" ${out ? "disabled" : ""}>${icon("plus")}</button></div>
      <button class="btn btn-primary btn-lg" style="flex:1" data-add-custom data-act="add" ${out ? "disabled" : ""}>${icon("cart")} Add to cart</button>
      <button class="btn btn-dark btn-lg" data-add-custom data-act="buy" ${out ? "disabled" : ""}>Buy now</button>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-wish="${product.id}" aria-pressed="${Wish.has(product.id)}" ${Wish.has(product.id) ? 'class="on"' : ""}>${icon("heart")} ${Wish.has(product.id) ? "Saved" : "Add to wishlist"}</button>
      ${wa ? html`<a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")} Ask on WhatsApp</a>` : ""}
    </div>
    <div class="pdp-assure">
      ${product.warranty ? html`<div>${icon("shield")}<span><b>Warranty:</b> ${product.warranty}</span></div>` : ""}
      <div>${icon("truck")}<span>Delivery fee shown before you pay. Check your state under the <a href="#delivery" data-goto="delivery">Delivery tab</a>.</span></div>
      <div>${icon("lock")}<span>Secure payment with ${cfg.payments.methods.filter((m) => m !== "bank_transfer").map((m) => m === "paystack" ? "Paystack" : "Flutterwave").join(" or ") || "bank transfer"}.</span></div>
    </div>`;
}

const gallery = product.images.length ? product.images : [{ url: "", thumb: "", alt: product.name }];
function galleryHtml() {
  return html`<div class="gallery-main"><img id="main-img" src="${assetUrl(gallery[imgIdx].url)}" alt="${gallery[imgIdx].alt}" width="700" height="700"></div>
    ${gallery.length > 1 ? html`<div class="thumbs">${gallery.map((g, i) => html`<button data-img="${i}" aria-current="${i === imgIdx}" aria-label="View image ${i + 1}"><img src="${assetUrl(g.thumb || g.url)}" alt="" loading="lazy"></button>`)}</div>` : ""}`;
}

const crumbs = [["Home", "/"], ...product.breadcrumb.map((c) => [c.name, `/category/${c.slug}`])];
app.innerHTML = html`<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs.map(([t, h]) => html`<a href="${h}">${t}</a><span class="sep">/</span>`)}<span aria-current="page">${product.name}</span></nav>
  <div class="pdp"><div class="gallery" id="gallery">${galleryHtml()}</div>
    <div class="pdp-info"><div class="pdp-meta">${product.brand ? html`<a href="/shop?brand=${product.brand.slug}"><b>${product.brand.name}</b></a>` : ""}${product.newArrival ? html`<span class="tag tag-new">New</span>` : ""}${product.bestseller ? html`<span class="tag tag-hot">Best seller</span>` : ""}</div>
      <h1>${product.name}</h1>
      <div class="pdp-meta">${product.ratingCount ? html`${stars(product.ratingAvg)}<a href="#reviews" data-goto="reviews">${product.ratingAvg.toFixed(1)} (${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"})</a>` : html`<span>No reviews yet</span>`}</div>
      <div id="buy">${buyHtml()}</div></div></div>
  <section class="section" style="padding-top:36px"><div class="tabs" role="tablist"><button class="tab" role="tab" data-tab="overview" aria-selected="true">Overview</button><button class="tab" role="tab" data-tab="specs" aria-selected="false">Specifications</button><button class="tab" role="tab" data-tab="reviews" aria-selected="false">Reviews (${product.ratingCount})</button><button class="tab" role="tab" data-tab="delivery" aria-selected="false">Delivery</button></div>
    <div class="tab-panel" id="panel"></div></section>
  <section class="section" id="related-sec" hidden><div class="section-head"><h2>You may also like</h2></div><div class="grid" id="related"></div></section>
</div>
<div class="sticky-buy" id="sticky"></div>`.toString();

function stickyHtml() {
  const v = current();
  return html`<div class="p">${naira(v.price)}<small>${Object.values(v.attrs).slice(0, 3).join(" · ")}</small></div>${v.stock > 0 ? html`<button class="btn btn-primary" data-add-custom data-act="add">${icon("cart")} Add to cart</button>` : html`<span class="tag tag-out">Out of stock</span>`}`;
}
const redraw = () => { $("#buy").innerHTML = buyHtml().toString(); $("#sticky").innerHTML = stickyHtml().toString(); };
$("#sticky").innerHTML = stickyHtml().toString();

/* ---------------------------- tab panels ---------------------------- */
const panels = {
  overview: () => html`<div class="prose">${product.highlights.length ? html`<ul class="highlights">${product.highlights.map((h) => html`<li>${icon("check")}<span>${h}</span></li>`)}</ul>` : ""}${(product.description || "").split(/\n{2,}/).filter(Boolean).map((p) => html`<p>${p}</p>`)}${product.network ? html`<p><b>Network / SIM:</b> ${product.network}</p>` : ""}</div>`,
  specs: () => product.specGroups.length ? html`<div style="max-width:820px">${product.specGroups.map((g) => html`<div class="spec-group"><h3>${g.group}</h3><table class="spec-table"><tbody>${g.items.map((i) => html`<tr><th scope="row">${i.label}</th><td>${i.value}</td></tr>`)}</tbody></table></div>`)}</div>` : html`<p class="muted">No specifications have been added yet.</p>`,
  delivery: () => html`<div style="max-width:620px"><p>Choose your state to see delivery methods and fees for this item.</p><div class="field"><label for="d-state">State</label><select class="select" id="d-state"><option value="">Select your state</option>${cfg.states.map((s) => html`<option>${s}</option>`)}</select></div><div id="d-result"></div></div>`,
};
let tab = "overview";
async function showTab(name) {
  tab = name;
  $$("[data-tab]").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
  const p = $("#panel");
  if (name === "reviews") return renderReviews();
  p.innerHTML = panels[name]().toString();
  if (name === "delivery") $("#d-state").addEventListener("change", async (e) => {
    const out = $("#d-result");
    if (!e.target.value) return (out.innerHTML = "");
    out.innerHTML = `<span class="spinner"></span>`;
    try {
      const r = await get("/delivery/options", { state: e.target.value, subtotal: current().price });
      out.innerHTML = r.available ? r.options.map((o) => html`<div class="radio-card" style="cursor:default"><div><b>${o.name}</b><div class="sub">${o.eta || ""}${o.free ? " · Free for this order" : o.freeOver ? ` · Free over ${naira(o.freeOver)}` : ""}</div></div><span class="amt">${o.fee === 0 ? "Free" : naira(o.fee)}</span></div>`).join("") : html`<div class="alert alert-warn">We don't deliver to ${e.target.value} online yet. Please message us on WhatsApp and we'll arrange it.</div>`.toString();
    } catch (err) { out.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`; }
  });
}

let reviewPage = 1, loadedReviews = [];
async function renderReviews(more = false) {
  const p = $("#panel");
  if (!more) { reviewPage = 1; loadedReviews = []; p.innerHTML = `<span class="spinner"></span>`; }
  const r = await get(`/products/${product.id}/reviews`, { page: reviewPage });
  loadedReviews.push(...r.reviews);
  const total = product.distribution.reduce((s, d) => s + d.count, 0);
  await loadSession();
  p.innerHTML = html`<div style="max-width:820px">
    ${product.ratingCount ? html`<div class="rating-summary"><div><div class="rating-big">${product.ratingAvg.toFixed(1)}</div>${stars(product.ratingAvg)}<div class="small muted">${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}</div></div><div>${product.distribution.map((d) => html`<div class="bar-row"><span>${d.stars} star</span><div class="bar"><i style="width:${total ? (d.count / total) * 100 : 0}%"></i></div><span>${d.count}</span></div>`)}</div></div>` : html`<p class="muted">No reviews yet. Be the first to share your experience.</p>`}
    ${loadedReviews.map((rv) => html`<article class="review">${stars(rv.rating)} ${rv.verifiedPurchase ? html`<span class="tag tag-ok" style="margin-left:8px">Verified purchase</span>` : ""}${rv.title ? html`<h4>${rv.title}</h4>` : ""}<p style="margin:4px 0">${rv.body}</p><span class="small muted">${rv.author} · ${dateShort(rv.createdAt)}</span></article>`)}
    ${r.page < r.pages ? html`<button class="btn btn-ghost" id="more-reviews" style="margin-top:16px">Show more reviews</button>` : ""}
    <div class="panel" style="margin-top:28px"><h3 class="panel-title">Write a review</h3>
    ${session.user ? html`<form id="review-form" novalidate><div class="field"><span class="label">Your rating</span><div class="star-input" id="star-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-star="${n}" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}">${icon("star")}</button>`)}</div><input type="hidden" name="rating"><div class="field-error"></div></div>
      <div class="field"><label for="rv-title">Title (optional)</label><input class="input" id="rv-title" name="title" maxlength="120"></div>
      <div class="field"><label for="rv-body">Your review</label><textarea class="textarea" id="rv-body" name="body" maxlength="2000"></textarea></div><button class="btn btn-primary" type="submit">Submit review</button></form>`
      : html`<p><a href="/login?next=${encodeURIComponent(location.pathname)}">Sign in</a> to review this product.</p>`}</div></div>`.toString();
  $("#more-reviews")?.addEventListener("click", () => { reviewPage++; renderReviews(true); });
  const form = $("#review-form");
  if (form) {
    $$("[data-star]", form).forEach((b) => b.addEventListener("click", () => { form.rating.value = b.dataset.star; $$("[data-star]", form).forEach((x) => { const on = Number(x.dataset.star) <= Number(b.dataset.star); x.classList.toggle("on", on); x.setAttribute("aria-checked", Number(x.dataset.star) === Number(b.dataset.star)); }); }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); clearAlert(form);
      const rating = Number(form.rating.value);
      if (!rating) return formAlert(form, "Please choose a star rating.");
      await withLoading(form.querySelector("button[type=submit]"), async () => {
        try { const r = await post(`/products/${product.id}/reviews`, { rating, title: form.title.value, body: form.body.value }); toast(r.message); form.reset(); if (r.status === "approved") location.reload(); else formAlert(form, r.message, "ok"); }
        catch (err) { if (!showFieldErrors(form, err.fields)) formAlert(form, err.message); }
      });
    });
  }
}
showTab("overview");

/* ---------------------------- interactions ---------------------------- */
document.addEventListener("click", (e) => {
  const t = e.target;
  const opt = t.closest("[data-opt]");
  if (opt) { pickOption(opt.dataset.opt, opt.dataset.val); qty = 1; redraw(); const v = current();   if (v.image) { const i = gallery.findIndex((g) => g.url === v.image); if (i >= 0) { imgIdx = i; $("#gallery").innerHTML = galleryHtml().toString(); } } return; }
  const th = t.closest("[data-img]");
  if (th) { imgIdx = Number(th.dataset.img); $("#gallery").innerHTML = galleryHtml().toString(); return; }
  const q = t.closest("[data-q]");
  if (q) { const v = current(); qty = Math.max(1, Math.min(Math.min(10, v.stock), qty + Number(q.dataset.q))); $("#qty").value = qty; return; }
  const tabBtn = t.closest("[data-tab]");
  if (tabBtn) return showTab(tabBtn.dataset.tab);
  const go = t.closest("[data-goto]");
  if (go) { e.preventDefault(); showTab(go.dataset.goto); $("#panel").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const act = t.closest("[data-act]");
  if (act) {
    const v = current();
    if (v.stock <= 0) return;
    const n = Math.max(1, Math.min(v.stock, Number($("#qty")?.value) || qty));
    Cart.add(product.id, v.sku, n);
    if (act.dataset.act === "buy") location.href = "/checkout";
    else { toast("Added to cart"); openDrawer("#cart-drawer"); }
  }
});
document.addEventListener("change", (e) => { if (e.target.id === "qty") { const v = current(); qty = Math.max(1, Math.min(Math.min(10, v.stock), Number(e.target.value) || 1)); e.target.value = qty; } });

// related products
get(`/products/${product.id}/related`).then((r) => {
  if (!r.products.length) return;
  $("#related-sec").hidden = false;
  $("#related").innerHTML = r.products.slice(0, 4).map((p) => productCard(p).toString()).join("");
}).catch(() => {});
